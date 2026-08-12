// Edge Function: backfill-item-metadata  (one-off admin ops endpoint)
// POST /functions/v1/backfill-item-metadata
//
// Purpose: the fit/outfit engine is starved because `fit`, `material`, `pattern`,
// and `warmth_season` are ~99% NULL on live `clothing_items`, so the engine falls
// back to constant defaults and outfit quality suffers. This endpoint re-runs the
// SAME Gemini vision detector used at ingest (generate-item-image) on each item's
// stored product photo and BACKFILLS only the columns that are currently NULL —
// it never overwrites a value a human/earlier extraction already set.
//
// This is a MANUAL admin tool, NOT user-facing:
//   - Guarded by SERVICE_ROLE (reads/updates across all users, bypassing RLS).
//   - Requires header  x-admin-secret == env BACKFILL_ADMIN_SECRET  (fail closed).
//
// Body (all optional): { limit?: number, dry_run?: boolean, wardrobe_id?: string }
//   limit       max rows to scan this run (default 200).
//   dry_run     compute would-be updates but DON'T write (default false).
//   wardrobe_id restrict to one wardrobe.
//
// Returns: { scanned, updated, skipped, failed, dry_run,
//            details: [{ id, type, filled: string[], skipped?: string, error? }] }
//
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_API_KEY,
//                   BACKFILL_ADMIN_SECRET.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Image } from 'https://deno.land/x/imagescript@1.2.17/mod.ts';
import {
  EXTRACTION_SYSTEM, buildUserPrompt, snapGarment, GarmentMetadata, snapType,
} from '../generate-item-image/prompt.ts';
// Measured-hex color layer (2026-07-06) — same deterministic pixel extraction
// generate-item-image uses at ingest; the backfill fills primary_hex/
// secondary_hex for items whose photo predates it. Pure pixel algorithm, no
// Gemini call needed for this part.
import { dominantHexes } from '../generate-outfits/engine/colorCluster.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-secret',
};

// Mirror generate-item-image exactly: same vision model + endpoint shape.
// GEMINI_FLASH_MODEL is the shared vision/text-tier secret — same var moves
// generate-item-image, map-measurements, tryon-validate, and curator.ts
// together. Default stays gemini-2.5-flash (retires 2026-10-16 — priced
// upgrade path + rationale in generate-item-image/index.ts's VISION_MODEL
// comment).
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const VISION_MODEL = Deno.env.get('GEMINI_FLASH_MODEL') || 'gemini-2.5-flash';

// The private bucket that holds wardrobe item photos (see itemPhotoService.ts /
// 20260614000001_clothing_items_photo_storage.sql). For photo_storage='cloud',
// photo_url is the storage PATH `{userId}/{itemId}.{ext}` inside this bucket.
const PHOTO_BUCKET = 'wardrobe-photos';

const DEFAULT_LIMIT = 100;
// Cap (audit 2026-07-03): 1000 items × up to 3 Gemini attempts each, even at
// CONCURRENCY=3, is certain to blow the edge function wall-clock. 150 keeps a
// worst-case run well inside budget; callers page via `offset` for more.
const MAX_LIMIT = 150;
const SIGNED_URL_TTL = 600; // seconds
const CONCURRENCY = 3;      // ≤ 3 to stay under Gemini rate limits
const GEMINI_TIMEOUT_MS = 20000; // generation is slower than a text-only call

interface GeminiPart { text?: string; inlineData?: { mimeType: string; data: string } }
interface GeminiResponse { candidates?: Array<{ content?: { parts?: GeminiPart[] } }> }

// Row shape we read + decide on. Only the columns we may fill plus the keys we
// need to resolve an image and pick the right detection.
interface ItemRow {
  id: string;
  type: string | null;
  color: string | null;
  primary_color: string | null;
  material: string | null;
  fit: string | null;
  pattern: string | null;
  warmth_season: string | null;
  can_layer: boolean | null;
  print_scale: string | null;
  drape: string | null;
  visual_interest: number | null;
  graphics: unknown;
  photo_url: string | null;
  photo_storage: string | null;
  primary_hex: string | null;
  secondary_hex: string | null;
  distressed: boolean | null;
  opacity: string | null;
}

const SELECT_COLS =
  'id, type, color, primary_color, material, fit, pattern, warmth_season, can_layer, print_scale, drape, visual_interest, graphics, photo_url, photo_storage, primary_hex, secondary_hex, distressed, opacity';

// ─── Gemini vision (mirrors generate-item-image geminiDetect) ─────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const TRANSIENT = new Set([429, 500, 502, 503, 504]);

async function geminiDetect(apiKey: string, image: GeminiPart): Promise<string> {
  const body = JSON.stringify({
    system_instruction: { parts: [{ text: EXTRACTION_SYSTEM }] },
    // No notes, no body scale — we only want the visual attributes of the item.
    contents: [{ parts: [image, { text: buildUserPrompt() }] }],
    generationConfig: { responseModalities: ['TEXT'], temperature: 0.2 },
  });
  let lastErr = 'Gemini vision failed';
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${GEMINI_BASE}/${VISION_MODEL}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
        body,
      });
    } catch (e) {
      lastErr = `Gemini vision network: ${(e as Error).message}`;
      await sleep(600 * (attempt + 1));
      continue;
    }
    if (res.ok) {
      const data: GeminiResponse = await res.json();
      return data.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text ?? '';
    }
    lastErr = `Gemini vision ${res.status}: ${(await res.text()).slice(0, 300)}`;
    if (!TRANSIENT.has(res.status)) break;
    await sleep(700 * (attempt + 1));
  }
  throw new Error(lastErr);
}

function parseGarments(rawJson: string): GarmentMetadata[] {
  let parsed: unknown = [];
  try {
    const cleaned = rawJson.replace(/```(?:json)?\n?/g, '').replace(/```\n?/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map((p) => snapGarment(p)).filter((g): g is GarmentMetadata => g !== null);
}

// ─── Image resolution ─────────────────────────────────────────────────────────

// Chunked base64 of binary bytes (Deno btoa would blow the call stack on a big
// String.fromCharCode spread). Same approach as generate-item-image's u8ToB64.
function u8ToB64(u8: Uint8Array): string {
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < u8.length; i += CH) {
    bin += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + CH)));
  }
  return btoa(bin);
}

// Measured-hex color layer — reverse of u8ToB64, to decode the fetched image
// bytes (already base64 inside the GeminiPart) back into a Uint8Array for
// Image.decode.
function b64ToU8(b64: string): Uint8Array {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

function mimeFromUrlOrHeader(url: string, contentType: string | null): string {
  if (contentType && contentType.startsWith('image/')) return contentType.split(';')[0].trim();
  return /\.png(\?|$)/i.test(url) ? 'image/png' : 'image/jpeg';
}

// Turn a row into a Gemini inlineData image part, or throw with a clear reason.
// Preference order:
//   1. photo_storage='cloud'  → FRESH signed URL from PHOTO_BUCKET on photo_url (the path).
//   2. photo_url is an absolute http(s) URL (e.g. seeded product image) → fetch directly.
// Local-only photos (photo_storage='local', or asset:/relative paths) live on a
// user's device and are NOT fetchable server-side → throw (counts as skipped).
// SSRF guard (audit 2026-07-03): photo_url is user-writable, so an absolute URL
// stored there must NEVER be fetched blindly — an attacker could point it at
// internal/metadata endpoints and have this admin function fetch on their behalf.
// Allowed: the project's own Supabase Storage, plus optional extra hosts from the
// BACKFILL_IMAGE_HOSTS env (comma-separated) for future seed/product imports.
function isAllowedImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    const base = Deno.env.get('SUPABASE_URL');
    if (base && u.host === new URL(base).host && u.pathname.startsWith('/storage/')) return true;
    const extra = (Deno.env.get('BACKFILL_IMAGE_HOSTS') ?? '')
      .split(',').map(h => h.trim().toLowerCase()).filter(Boolean);
    return extra.includes(u.host.toLowerCase());
  } catch {
    return false;
  }
}

async function resolveImagePart(admin: SupabaseClient, row: ItemRow): Promise<GeminiPart> {
  const path = row.photo_url;
  if (!path) throw new Error('no photo_url');

  let fetchUrl: string | null = null;

  if (row.photo_storage === 'cloud') {
    const { data, error } = await admin.storage.from(PHOTO_BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
    if (!error && data?.signedUrl) fetchUrl = data.signedUrl;
  }

  // Fallback: an absolute URL stored directly in photo_url (seed/product images).
  // MUST pass the SSRF allowlist — photo_url is user-writable.
  if (!fetchUrl && /^https?:\/\//i.test(path)) {
    if (!isAllowedImageUrl(path)) throw new Error('blocked non-allowlisted photo_url host');
    fetchUrl = path;
  }

  // As a last resort for rows mislabelled but actually in the bucket, try signing
  // the path even when photo_storage isn't 'cloud' (never for local/relative/asset).
  if (!fetchUrl && row.photo_storage !== 'local' && !path.startsWith('asset:') && !path.startsWith('wardrobe-photos/')) {
    const { data } = await admin.storage.from(PHOTO_BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
    if (data?.signedUrl) fetchUrl = data.signedUrl;
  }

  if (!fetchUrl) throw new Error(`unfetchable image (photo_storage=${row.photo_storage ?? 'null'})`);

  // redirect:'error' — an allowlisted host must not bounce us elsewhere.
  const res = await fetch(fetchUrl, { redirect: 'error' });
  if (!res.ok) throw new Error(`image fetch ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.length === 0) throw new Error('empty image');
  const mimeType = mimeFromUrlOrHeader(path, res.headers.get('content-type'));
  return { inlineData: { mimeType, data: u8ToB64(buf) } };
}

// ─── Detection selection ──────────────────────────────────────────────────────

// Product photos are usually a single isolated garment, so expect 1 detection.
// If several, prefer the one whose snapped type matches the row's existing type;
// otherwise take the highest-confidence detection.
function pickBest(garments: GarmentMetadata[], existingType: string | null): GarmentMetadata | null {
  if (garments.length === 0) return null;
  if (garments.length === 1) return garments[0];
  if (existingType) {
    const want = snapType(existingType);
    const match = garments
      .filter((g) => snapType(g.type) === want)
      .sort((a, b) => b.confidence - a.confidence)[0];
    if (match) return match;
  }
  return [...garments].sort((a, b) => b.confidence - a.confidence)[0];
}

// ─── Per-item processing ──────────────────────────────────────────────────────

interface ItemResult {
  id: string;
  type: string | null;
  filled: string[];
  skipped?: string;
  error?: string;
}

async function processItem(
  admin: SupabaseClient, apiKey: string, row: ItemRow, dryRun: boolean,
): Promise<{ status: 'updated' | 'skipped' | 'failed'; result: ItemResult }> {
  try {
    const image = await resolveImagePart(admin, row);

    // Build a patch of ONLY currently-NULL columns. Never overwrite existing values.
    const patch: Record<string, unknown> = {};
    const filled: string[] = [];

    // Only call Gemini when at least one of ITS columns is still NULL — an item
    // that only needs primary_hex/secondary_hex (measured-hex layer, below) skips
    // the vision call entirely, since hex extraction is a pure pixel algorithm.
    const needsGemini =
      row.material == null || row.fit == null || row.pattern == null ||
      row.warmth_season == null || row.can_layer == null || row.print_scale == null ||
      row.drape == null || row.visual_interest == null || row.primary_color == null ||
      row.graphics == null || row.distressed == null || row.opacity == null;

    if (needsGemini) {
      const garments = parseGarments(await geminiDetect(apiKey, image));
      const best = pickBest(garments, row.type);
      if (best) {
        if (row.material == null && best.material) {
          // fabric_types.name FK is lowercase; snapMaterial returns Title Case → normalise
          // (matches wardrobeService).
          patch.material = best.material.toLowerCase();
          filled.push('material');
        }
        if (row.fit == null && best.fit) { patch.fit = best.fit; filled.push('fit'); }
        if (row.pattern == null && best.pattern) { patch.pattern = best.pattern; filled.push('pattern'); }
        if (row.warmth_season == null && best.warmth_season) {
          patch.warmth_season = best.warmth_season; filled.push('warmth_season');
        }
        // can_layer (dual-role layering, 2026-07-03): only fill a confident boolean;
        // null stays null so the engine's rule derivation keeps deciding.
        if (row.can_layer == null && typeof best.can_layer === 'boolean') {
          patch.can_layer = best.can_layer; filled.push('can_layer');
        }
        // distressed (2026-08-11): only fill a confident boolean; null stays
        // null (fail-open — featuresPasses never rejects on an unassessed item).
        if (row.distressed == null && typeof best.distressed === 'boolean') {
          patch.distressed = best.distressed; filled.push('distressed');
        }
        // opacity (2026-08-14): only fill a confident controlled value; null
        // stays null (deriveCanBeSoleTop treats null the same as 'opaque').
        if (row.opacity == null && best.opacity) {
          patch.opacity = best.opacity; filled.push('opacity');
        }
        // Visual enrichment đợt 2 (2026-07-03): only fill confident non-null values.
        if (row.print_scale == null && best.print_scale) { patch.print_scale = best.print_scale; filled.push('print_scale'); }
        if (row.drape == null && best.drape) { patch.drape = best.drape; filled.push('drape'); }
        if (row.visual_interest == null && typeof best.visual_interest === 'number') {
          patch.visual_interest = best.visual_interest; filled.push('visual_interest');
        }
        // primary_color mirrors wardrobeService (`primary_color: primaryColor ?? color`):
        // it stores the same colour string as `color`. Use the snapped detection colour.
        if (row.primary_color == null && best.color) {
          patch.primary_color = best.color; filled.push('primary_color');
        }
        // graphics is the LogoSignal jsonb blob (sanitizeGraphics output via snapGarment).
        if (row.graphics == null && best.graphics) {
          patch.graphics = best.graphics; filled.push('graphics');
        }
      }
      // best === null (no detection) → no Gemini-derived columns filled this
      // run; the measured-hex pass below is independent and still runs.
    }

    // Measured-hex color layer (2026-07-06) — deterministic pixel extraction,
    // no Gemini call needed. Runs whenever either hex column is still NULL,
    // reusing the same image bytes already fetched for Gemini above (or fetched
    // solely for this when needsGemini was false). Never fails the item —
    // a decode error just leaves the hex columns unfilled.
    if (row.primary_hex == null || row.secondary_hex == null) {
      try {
        const decoded = await Image.decode(b64ToU8(image.inlineData!.data));
        const { primaryHex, secondaryHex } = dominantHexes(decoded.bitmap, decoded.width, decoded.height);
        if (row.primary_hex == null && primaryHex) { patch.primary_hex = primaryHex; filled.push('primary_hex'); }
        if (row.secondary_hex == null && secondaryHex) { patch.secondary_hex = secondaryHex; filled.push('secondary_hex'); }
      } catch (e) {
        console.warn('[backfill-item-metadata] hex decode failed:', row.id, (e as Error).message);
      }
    }

    if (filled.length === 0) {
      return { status: 'skipped', result: { id: row.id, type: row.type, filled: [], skipped: 'nothing to fill' } };
    }

    if (!dryRun) {
      const { error } = await admin.from('clothing_items').update(patch).eq('id', row.id);
      if (error) {
        return { status: 'failed', result: { id: row.id, type: row.type, filled: [], error: `update: ${error.message}` } };
      }
    }
    return { status: 'updated', result: { id: row.id, type: row.type, filled } };
  } catch (e) {
    return { status: 'failed', result: { id: row.id, type: row.type, filled: [], error: (e as Error).message } };
  }
}

// Constant-time shared-secret check (mirrors revenuecat-webhook's secretMatches).
// Comparing SHA-256 digests instead of raw strings hides length + content from
// timing analysis — a plain `!==` leaks how many leading bytes matched.
async function secretMatches(provided: string | null, expected: string): Promise<boolean> {
  if (!provided) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(provided)),
    crypto.subtle.digest('SHA-256', enc.encode(expected)),
  ]);
  const av = new Uint8Array(a), bv = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < av.length; i++) diff |= av[i] ^ bv[i];
  return diff === 0;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return jsonResponse({ ok: true }, 200);

  try {
    // ── Admin gate (fail closed) ───────────────────────────────────────────
    const adminSecret = Deno.env.get('BACKFILL_ADMIN_SECRET');
    if (!adminSecret || !(await secretMatches(req.headers.get('x-admin-secret'), adminSecret))) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) return jsonResponse({ error: 'Service role not configured' }, 503);

    const apiKey = Deno.env.get('GOOGLE_API_KEY');
    if (!apiKey) return jsonResponse({ error: 'GOOGLE_API_KEY not configured' }, 503);

    const admin = createClient(url, serviceKey);

    // ── Parse body ─────────────────────────────────────────────────────────
    const body = (await req.json().catch(() => ({}))) as {
      limit?: number; dry_run?: boolean; wardrobe_id?: string; offset?: number;
    };
    const limit = Number.isFinite(body.limit) && (body.limit as number) > 0
      ? Math.min(Math.floor(body.limit as number), MAX_LIMIT)
      : DEFAULT_LIMIT;
    const offset = Number.isFinite(body.offset) && (body.offset as number) >= 0
      ? Math.floor(body.offset as number)
      : 0;
    const dryRun = body.dry_run === true;
    const wardrobeId = typeof body.wardrobe_id === 'string' ? body.wardrobe_id : null;

    // ── Select targets: have a fetchable image AND ≥1 of the style cols is NULL ─
    // Deterministic ORDER BY id + an offset so callers can PAGE through the full
    // set in small fresh-worker chunks — without ordering, LIMIT keeps returning
    // the same head rows (e.g. shoes/bags whose missing col the model never fills),
    // starving the fillable garments behind them and risking an OOM on a big limit.
    let query = admin
      .from('clothing_items')
      .select(SELECT_COLS)
      .not('photo_url', 'is', null)
      .or('fit.is.null,material.is.null,pattern.is.null,warmth_season.is.null,can_layer.is.null,drape.is.null,visual_interest.is.null,primary_hex.is.null,secondary_hex.is.null,distressed.is.null,opacity.is.null')
      .order('id', { ascending: true })
      .range(offset, offset + limit - 1);
    if (wardrobeId) query = query.eq('wardrobe_id', wardrobeId);

    const { data: rows, error: selErr } = await query;
    if (selErr) return jsonResponse({ error: `select: ${selErr.message}` }, 500);

    const targets = (rows ?? []) as ItemRow[];

    // ── Process with bounded concurrency (≤ 3) ─────────────────────────────
    const details: ItemResult[] = [];
    let updated = 0, skipped = 0, failed = 0;
    for (let i = 0; i < targets.length; i += CONCURRENCY) {
      const batch = targets.slice(i, i + CONCURRENCY);
      const settled = await Promise.all(batch.map((r) => processItem(admin, apiKey, r, dryRun)));
      for (const s of settled) {
        details.push(s.result);
        if (s.status === 'updated') updated++;
        else if (s.status === 'skipped') skipped++;
        else failed++;
      }
    }

    return jsonResponse(
      { scanned: targets.length, updated, skipped, failed, offset, limit, dry_run: dryRun, details },
      200,
    );
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[backfill-item-metadata] Error:', detail);
    return jsonResponse({ error: 'Internal server error', detail }, 500);
  }
});

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
