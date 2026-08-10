// Edge Function: generate-item-image  (feature 006-ai-item-extraction)
// POST /functions/v1/generate-item-image
// Auth: Bearer token (Supabase JWT). Requires GOOGLE_API_KEY secret.
//
// Input:  { photo_uri: string (base64 data URI of ONE worn-outfit photo), notes?: string }
// Output: { items: ExtractedItemWithImage[] }
//   ExtractedItemWithImage = { image_data: base64|"", mime_type: string, metadata: GarmentMetadata }
//
// Pipeline (Gemini for both steps):
//   1) gemini-2.5-flash (vision → text): detect every garment the primary subject wears,
//      returning a controlled-vocabulary JSON array. Each object is validated/snapped
//      server-side (prompt.ts) so no free text in controlled fields reaches the client.
//   2) gemini-3-pro-image-preview (nano banana 2, image out): for EACH garment, send the
//      ORIGINAL photo + an isolation prompt → an isolated product image on white background.
//      All garments run in parallel; array order is the data↔image pairing contract.
//   A per-item image failure yields image_data:"" (the item is still returned).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Image } from 'https://deno.land/x/imagescript@1.2.17/mod.ts';
import {
  EXTRACTION_SYSTEM, buildUserPrompt, buildIsolationPrompt, snapGarment, GarmentMetadata,
  pickChromaBg, ChromaBg, formatBodyScale, BodyScale,
} from './prompt.ts';
// Measured-hex color layer (2026-07-06) — deterministic pixel-derived dominant
// colour(s) of the ISOLATED item image, distinct from the model's own
// color_hex text guess. Cross-function import from generate-outfits/engine is
// an established pattern (wardrobe-critic, evaluate-item already do this).
import { dominantHexes } from '../generate-outfits/engine/colorCluster.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const VISION_MODEL = 'gemini-2.5-flash';
const IMAGE_GEN_MODEL = 'gemini-3-pro-image-preview'; // nano banana 2 / Gemini 3 Pro Image
// Cap on how many detected garments fan out into paid image-generation calls
// per photo (2026-08-05). Step 2 (detect) is cheap text-out; step 3 (isolate,
// below) is one gemini-3-pro-image-preview call PER garment at ~$0.13/image —
// previously uncapped, so a single credit on a busy photo could trigger an
// unbounded number of paid generations. Extra garments beyond this cap are
// dropped (not silently — see the truncation log below).
const MAX_GARMENTS_PER_PHOTO = 3;

interface ExtractedItemWithImage {
  image_data: string;
  mime_type: string;
  metadata: GarmentMetadata;
  keyed: boolean;  // true = background removed server-side (transparent PNG)
}

interface GeminiPart { text?: string; inlineData?: { mimeType: string; data: string } }
interface GeminiResponse { candidates?: Array<{ content?: { parts?: GeminiPart[] } }> }

// ─── Gemini helpers ───────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const TRANSIENT = new Set([429, 500, 502, 503, 504]);
// AbortController timeouts (pattern mirrors evaluate-item/note.ts's generateFitNote).
// Without these, a hung Gemini call burns the whole edge-function wall-clock — the
// platform can kill the function before any credit refund logic runs.
const DETECT_TIMEOUT_MS = 15000;  // single image in, TEXT out — vision detect is fast
const ISOLATE_TIMEOUT_MS = 30000; // image OUT (nano banana 2) — much slower than text

async function geminiDetect(
  apiKey: string, image: GeminiPart, notes?: string, bodyScale?: string | null,
): Promise<string> {
  const body = JSON.stringify({
    system_instruction: { parts: [{ text: EXTRACTION_SYSTEM }] },
    contents: [{ parts: [image, { text: buildUserPrompt(notes, bodyScale) }] }],
    generationConfig: { responseModalities: ['TEXT'], temperature: 0.2 },
  });
  // Retry transient Gemini failures (overload/429/5xx/network) — these were the
  // cause of intermittent 500s on the scan path.
  let lastErr = 'Gemini vision failed';
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), DETECT_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${GEMINI_BASE}/${VISION_MODEL}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
        signal: ctrl.signal,
        body,
      });
    } catch (e) {
      lastErr = `Gemini vision network: ${(e as Error).message}`;
      await sleep(600 * (attempt + 1));
      continue;
    } finally {
      clearTimeout(t);
    }
    if (res.ok) {
      const data: GeminiResponse = await res.json();
      return data.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text ?? '';
    }
    lastErr = `Gemini vision ${res.status}: ${(await res.text()).slice(0, 300)}`;
    if (!TRANSIENT.has(res.status)) break;   // 4xx (e.g. bad key) → don't retry
    await sleep(700 * (attempt + 1));
  }
  throw new Error(lastErr);
}

async function geminiIsolate(
  apiKey: string, image: GeminiPart, g: GarmentMetadata, bg: ChromaBg, notes?: string,
): Promise<{ data: string; mimeType: string } | null> {
  const body = JSON.stringify({
    // Reference photo + per-item isolation instruction → image out. Client downscales to ~1K.
    contents: [{ parts: [image, { text: buildIsolationPrompt(g, notes, bg) }] }],
    generationConfig: { responseModalities: ['IMAGE'] },
  });
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ISOLATE_TIMEOUT_MS);
    try {
      const res = await fetch(`${GEMINI_BASE}/${IMAGE_GEN_MODEL}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
        signal: ctrl.signal,
        body,
      });
      if (!res.ok) {
        console.warn('[generate-item-image] isolate error:', res.status, (await res.text()).slice(0, 200));
        if (TRANSIENT.has(res.status) && attempt < 2) { await sleep(700 * (attempt + 1)); continue; }
        return null;
      }
      const data: GeminiResponse = await res.json();
      const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
      if (!part?.inlineData) return null;
      return { data: part.inlineData.data, mimeType: part.inlineData.mimeType };
    } catch (e) {
      console.warn('[generate-item-image] isolate threw:', (e as Error).message);
      if (attempt < 2) { await sleep(700 * (attempt + 1)); continue; }
      return null;
    } finally {
      clearTimeout(t);
    }
  }
  return null;
}

// ── Server-side chroma keying (feature 008) ──────────────────────────────────
// The AI returns the item on a uniform chroma background; we key that colour out
// into a transparent PNG deterministically (no on-device ML needed). Robust:
//   1. Refine the reference colour from the 4 corners (tolerates the model's drift).
//   2. FLOOD-FILL from the borders with a LOOSE tolerance — only background
//      connected to the edge is removed (so a near-chroma pixel INSIDE the garment
//      never punches a hole), but loose enough to follow the AI's slightly uneven
//      lighting/gradient instead of stopping mid-background.
//   3. Compute an edge BAND (a few px wide) just inside the cut, and across the
//      WHOLE band — not only the 1px boundary — feather the alpha by how strongly
//      each pixel still reads as the chroma colour AND despill (clamp the key
//      channels). This kills the magenta/green halo on the anti-aliased fringe,
//      which the old 1px pass left behind.
//   4. Sanity check: if we removed ~everything or ~nothing, treat as failure.

function b64ToU8(b64: string): Uint8Array {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

function u8ToB64(u8: Uint8Array): string {
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < u8.length; i += CH) {
    bin += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + CH)));
  }
  return btoa(bin);
}

// Mutates `buf` (RGBA) in place; returns the opaque fraction (for the sanity check).
function chromaKeyBitmap(buf: Uint8Array | Uint8ClampedArray, W: number, H: number, bg: ChromaBg): number {
  const N = W * H;

  // 1. Refine bg colour from corners when they agree; else trust the prompt colour.
  const cIdx = [0, W - 1, (H - 1) * W, (H - 1) * W + (W - 1)];
  let cr = 0, cg = 0, cb = 0;
  for (const p of cIdx) { const o = p * 4; cr += buf[o]; cg += buf[o + 1]; cb += buf[o + 2]; }
  cr = Math.round(cr / 4); cg = Math.round(cg / 4); cb = Math.round(cb / 4);
  let cspread = 0;
  for (const p of cIdx) { const o = p * 4; cspread = Math.max(cspread, Math.abs(buf[o] - cr) + Math.abs(buf[o + 1] - cg) + Math.abs(buf[o + 2] - cb)); }
  const ref = cspread <= 40 ? { r: cr, g: cg, b: cb } : { r: bg.r, g: bg.g, b: bg.b };

  const dist = (p: number) => { const o = p * 4; return Math.abs(buf[o] - ref.r) + Math.abs(buf[o + 1] - ref.g) + Math.abs(buf[o + 2] - ref.b); };

  // Key channels = the bright ones in the chroma colour (magenta → R+B; green → G).
  const isKey = [ref.r > 180, ref.g > 180, ref.b > 180];

  // Signed "chroma-ness": how strongly a pixel leans toward the key colour.
  //   magenta: min(R,B) − G ;  green: G − max(R,B). High positive → background-like.
  // Robust to lighting (it tracks the colour cast, not absolute brightness), and a
  // garment that gets a magenta bg is never magenta-dominant (pickChromaBg), so a
  // real garment edge reads ~0 or negative here.
  const chroma = (o: number): number => {
    let keyMin = 255, nonMax = 0;
    for (let c = 0; c < 3; c++) {
      if (isKey[c]) keyMin = Math.min(keyMin, buf[o + c]);
      else nonMax = Math.max(nonMax, buf[o + c]);
    }
    return keyMin - nonMax;
  };

  // 2. Flood-fill bg from the borders. TOL is loose so the fill follows the AI's
  //    uneven background lighting instead of stalling and leaving a magenta plate
  //    (the old TOL=72 was the main cause of keyed:false fallbacks). Connectivity
  //    from the border still protects every interior garment pixel.
  const TOL = 110;
  const isBg = new Uint8Array(N);
  const stack: number[] = [];
  const seed = (x: number, y: number) => {
    const p = y * W + x;
    if (!isBg[p] && dist(p) <= TOL) { isBg[p] = 1; stack.push(p); }
  };
  for (let x = 0; x < W; x++) { seed(x, 0); seed(x, H - 1); }
  for (let y = 0; y < H; y++) { seed(0, y); seed(W - 1, y); }
  const drain = () => {
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % W, y = (p / W) | 0;
      if (x > 0) seed(x - 1, y);
      if (x < W - 1) seed(x + 1, y);
      if (y > 0) seed(x, y - 1);
      if (y < H - 1) seed(x, y + 1);
    }
  };
  drain();

  // 2b. Enclosed background pools the border flood can't reach. The AI fills the
  //     WHOLE background with the chroma colour — including gaps the garment
  //     encloses (handle loops, the space between an arm and the torso, the hole
  //     in the middle of a buckle, …). The border-connected flood stops at the
  //     first garment pixel, so those interior pools stay opaque and a magenta/
  //     green plate survives in the MIDDLE of the item. Re-seed the flood from any
  //     pixel that STRICTLY matches the bg colour but wasn't reached, then grow it
  //     with the same loose TOL. pickChromaBg guarantees the garment never matches
  //     the chroma colour, so a strict-core match is always background — this can't
  //     punch a hole in the garment itself. The band step below then feathers +
  //     despills the rim of each interior hole exactly like the outer cut.
  const TOL_CORE = 60; // strict: only near-pure bg colour seeds an interior pool
  for (let p = 0; p < N; p++) {
    if (!isBg[p] && dist(p) <= TOL_CORE) { isBg[p] = 1; stack.push(p); }
  }
  drain();

  // 3. Edge BAND: BFS distance (in px) from the cut into the foreground, capped at
  //    BAND. Every pixel in the band gets despilled + alpha-feathered — not just the
  //    1px boundary — so the anti-aliased halo (2–4px of garment⊕chroma) is removed.
  const BAND = Math.max(2, Math.round(Math.min(W, H) / 350)); // ~3px at 1K
  const band = new Int16Array(N); // 0 = interior/unknown; >0 = px distance from cut
  let frontier: number[] = [];
  for (let p = 0; p < N; p++) {
    if (isBg[p]) continue;
    const x = p % W, y = (p / W) | 0;
    if ((x > 0 && isBg[p - 1]) || (x < W - 1 && isBg[p + 1]) ||
        (y > 0 && isBg[p - W]) || (y < H - 1 && isBg[p + W])) {
      band[p] = 1; frontier.push(p);
    }
  }
  for (let d = 1; d < BAND; d++) {
    const next: number[] = [];
    for (const p of frontier) {
      const x = p % W, y = (p / W) | 0;
      const nb = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1];
      for (const q of nb) { if (q >= 0 && !isBg[q] && band[q] === 0) { band[q] = d + 1; next.push(q); } }
    }
    frontier = next;
  }

  // 4. Compose: bg → transparent; interior → opaque untouched; band → feather by the
  //    ORIGINAL chroma-ness, then despill the colour so no chroma tint survives.
  const C_HI = 120;   // chroma ≥ this in the band → treat as residual bg (alpha 0)
  const C_LO = 20;    // chroma ≤ this → fully opaque
  const MARGIN = 12;  // despill: a key channel may exceed the non-key max by ≤ this

  let opaque = 0;
  for (let p = 0; p < N; p++) {
    const o = p * 4;
    if (isBg[p]) { buf[o + 3] = 0; continue; }
    if (band[p] === 0) { buf[o + 3] = 255; opaque++; continue; } // interior garment

    const ch = chroma(o);
    let a = 255;
    if (ch > C_LO) a = ch >= C_HI ? 0 : Math.round((255 * (C_HI - ch)) / (C_HI - C_LO));

    // Despill: pull the key channels down to the non-key level so the halo can't tint.
    let nonMax = 0;
    for (let c = 0; c < 3; c++) if (!isKey[c]) nonMax = Math.max(nonMax, buf[o + c]);
    for (let c = 0; c < 3; c++) if (isKey[c] && buf[o + c] > nonMax + MARGIN) buf[o + c] = nonMax + MARGIN;

    buf[o + 3] = a;
    if (a > 0) opaque++;
  }
  return opaque / N;
}

// Decode the AI image, key out the chroma bg, return a transparent PNG (base64).
// Never throws: on any failure / degenerate result, returns the original untouched
// with keyed:false so the client can fall back to its on-device cut-out.
async function keyChroma(base64Data: string, bg: ChromaBg): Promise<{ data: string; keyed: boolean }> {
  try {
    const img = await Image.decode(b64ToU8(base64Data));
    const frac = chromaKeyBitmap(img.bitmap, img.width, img.height, bg);
    if (frac < 0.05 || frac > 0.97) return { data: base64Data, keyed: false };
    const png = await img.encode();
    return { data: u8ToB64(png), keyed: true };
  } catch (e) {
    console.warn('[generate-item-image] keyChroma failed:', (e as Error).message);
    return { data: base64Data, keyed: false };
  }
}

// ── Auto-add new colours to the `colors` lookup (feature 008) ────────────────
// The AI may name a colour outside the curated palette. We persist it (service
// role — the table is RLS read-only to users) with attributes derived from the
// hex, so the FK on clothing_items.color holds AND the engine scores it.

const KNOWN_FAMILIES = new Set([
  'beige', 'black', 'blue', 'brown', 'burgundy', 'camel', 'charcoal', 'cream', 'gray',
  'green', 'ivory', 'metallic', 'multicolor', 'natural', 'navy', 'olive', 'orange',
  'pink', 'purple', 'red', 'tan', 'taupe', 'teal', 'white', 'yellow',
]);

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function familyFromHsl(h: number, s: number, l: number): string {
  if (s < 8) { if (l < 12) return 'black'; if (l < 35) return 'charcoal'; if (l < 75) return 'gray'; return 'white'; }
  if (l < 12) return 'black';
  if (h < 15 || h >= 345) return l < 30 ? 'burgundy' : 'red';
  if (h < 45) return l < 35 ? 'brown' : 'orange';
  if (h < 65) return 'yellow';
  if (h < 160) return (s < 35 || l < 35) ? 'olive' : 'green';
  if (h < 200) return 'teal';
  if (h < 255) return l < 30 ? 'navy' : 'blue';
  if (h < 290) return 'purple';
  return l < 45 ? 'purple' : 'pink';
}

function colorAttrsFromHex(name: string, hex: string | null) {
  const hsl = hex ? hexToHsl(hex) : null;
  if (!hsl) {
    return {
      name, hex: hex ?? '#999999', tag: 'NEUTRAL', primary_color: 'natural',
      lightness: 'medium', saturation: 'muted', hue: null as number | null,
      sat_pct: 15, lum_pct: 60, undertone: 'neutral', active: true,
    };
  }
  const { h, s, l } = hsl;
  const lightness = l < 35 ? 'dark' : l > 70 ? 'light' : 'medium';
  const saturation = s < 20 ? 'muted' : s > 55 ? 'vivid' : 'balanced';
  const undertone = s < 12 ? 'neutral' : (h < 70 || h >= 300) ? 'warm' : 'cool';
  const family = familyFromHsl(h, s, l);
  const primary_color = KNOWN_FAMILIES.has(family) ? family : 'natural';
  const tag = s < 12 ? 'NEUTRAL' : undertone === 'warm' ? 'WARM' : undertone === 'cool' ? 'COOL' : 'ACCENT';
  return {
    name, hex: hex!, tag, primary_color, lightness, saturation,
    hue: h as number | null, sat_pct: s, lum_pct: l, undertone, active: true,
  };
}

function hexToRgbTriple(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Ensure each garment's colour is FK-valid in `colors`:
//   1. Exact name already present  → keep (no-op).
//   2. Hex near-identical to an existing colour → REUSE that colour's name
//      (mutate g.color) instead of adding a near-duplicate.
//   3. Otherwise → insert a new colour with hex-derived attributes.
// The FK is on colors.name, so we always guarantee the name exists; the hex
// check only avoids duplicating colours that are effectively the same.
const HEX_DEDUPE_TOL = 30; // Manhattan RGB distance; only near-identical colours merge

async function ensureColors(garments: GarmentMetadata[]): Promise<void> {
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) return;
    if (!garments.some((g) => g.color)) return;

    const admin = createClient(url, serviceKey);
    const { data: existing, error } = await admin.from('colors').select('name, hex');
    if (error) { console.warn('[generate-item-image] ensureColors select:', error.message); return; }

    const nameHave = new Set<string>((existing ?? []).map((r: { name: string }) => r.name));
    const palette: Array<{ name: string; rgb: [number, number, number] }> = [];
    for (const r of (existing ?? []) as Array<{ name: string; hex: string | null }>) {
      const rgb = typeof r.hex === 'string' ? hexToRgbTriple(r.hex) : null;
      if (rgb) palette.push({ name: r.name, rgb });
    }

    const toInsert: ReturnType<typeof colorAttrsFromHex>[] = [];
    for (const g of garments) {
      const name = g.color;
      if (!name || nameHave.has(name)) continue;           // (1) name already valid

      const rgb = g.color_hex ? hexToRgbTriple(g.color_hex) : null;
      if (rgb && palette.length) {                          // (2) reuse a near-identical colour
        let best: { name: string; d: number } | null = null;
        for (const p of palette) {
          const d = Math.abs(p.rgb[0] - rgb[0]) + Math.abs(p.rgb[1] - rgb[1]) + Math.abs(p.rgb[2] - rgb[2]);
          if (!best || d < best.d) best = { name: p.name, d };
        }
        if (best && best.d <= HEX_DEDUPE_TOL) { g.color = best.name; continue; }
      }

      // (3) genuinely new colour → insert + register for later garments in this batch
      toInsert.push(colorAttrsFromHex(name, g.color_hex));
      nameHave.add(name);
      if (rgb) palette.push({ name, rgb });
    }

    if (toInsert.length > 0) {
      const { error: insErr } = await admin.from('colors').upsert(toInsert, { onConflict: 'name', ignoreDuplicates: true });
      if (insErr) console.warn('[generate-item-image] ensureColors insert:', insErr.message);
      else console.log(`[generate-item-image] +${toInsert.length} colour(s): ${toInsert.map((r) => r.name).join(', ')}`);
    }
  } catch (e) {
    console.warn('[generate-item-image] ensureColors failed:', (e as Error).message);
  }
}

function parseImage(photoUri: string): GeminiPart {
  if (!photoUri.startsWith('data:')) {
    throw new Error('photo_uri must be a base64 data URI (data:image/...;base64,...)');
  }
  const comma = photoUri.indexOf(',');
  const mimeType = photoUri.slice(0, comma).replace('data:', '').replace(';base64', '');
  return { inlineData: { mimeType, data: photoUri.slice(comma + 1) } };
}

function parseGarments(rawJson: string): GarmentMetadata[] {
  let parsed: unknown = [];
  try {
    const cleaned = rawJson.replace(/```(?:json)?\n?/g, '').replace(/```\n?/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    console.error('[generate-item-image] garment parse failed:', rawJson.slice(0, 300));
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map((p) => snapGarment(p)).filter((g): g is GarmentMetadata => g !== null);
}

// ─── Credit gate helper ───────────────────────────────────────────────────────

// Credit limits (2026-08-05). Source of truth: src/services/usageCreditService.ts
// (FREE_LIMITS / PREMIUM_LIMITS). Edge functions can't import from src/, so these
// are duplicated by hand — no shared cross-function module exists yet under
// supabase/functions/ for this. Keep both copies (here and in tryon-generate/
// index.ts) numerically in sync with usageCreditService.ts when a quota changes.
const FREE_LIMITS: Record<string, number> = { ai_extraction: 2, try_on: 2 };
const PREMIUM_LIMITS: Record<string, number> = { ai_extraction: 10, try_on: 15 };

interface MinimalClient {
  from: (table: string) => { select: (col: string) => { single: () => Promise<{ data: unknown }> } };
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
}

function monthPeriod(): string {
  return new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1),
  ).toISOString().slice(0, 10);
}

// Atomically consume one credit against the caller's tier limit. `demo` stays
// unlimited (App Store reviewers use this account and must not hit a wall
// mid-review — deliberate, unlike premium below). `premium` and `admin` (the
// server treats admin as quota'd premium — the client's hasPremiumAccountType()
// separately lumps admin in with premium for FEATURE access, a pre-existing
// inconsistency we don't fully unify here) now consume against a real monthly
// quota instead of bypassing the check entirely: both actions call
// gemini-3-pro-image-preview at ~$0.13/image, so marginal cost was previously
// unbounded for a premium subscriber. Returns a 402 Response when exhausted,
// plus whether a credit was actually consumed so the caller can refund it if
// the generation later fails/yields nothing.
async function gateCredit(
  supabase: MinimalClient,
  type: string,
  period: string,
): Promise<{ response: Response | null; consumed: boolean }> {
  let limit = FREE_LIMITS[type] ?? 2;
  try {
    const { data: prof } = await supabase.from('profiles').select('account_type').single();
    const accountType = (prof as { account_type?: string } | null)?.account_type;
    if (accountType === 'demo') return { response: null, consumed: false };
    if (accountType === 'premium' || accountType === 'admin') limit = PREMIUM_LIMITS[type] ?? limit;
  } catch {
    // profile fetch failure → fail open at the free limit (unchanged behavior)
  }

  const { data: gate, error: gateErr } = await supabase.rpc('consume_usage_credit', {
    p_type: type,
    p_period: period,
    p_limit: limit,
  });
  if (gateErr) {
    console.warn('[generate-item-image] credit gate RPC error (fail open):', gateErr.message);
    return { response: null, consumed: false };
  }
  const g = gate as { allowed: boolean; used: number; limit: number } | null;
  if (g && g.allowed === false) {
    return {
      response: jsonResponse({ error: 'credit_exhausted', credit_type: type, used: g.used, limit: g.limit }, 402),
      consumed: false,
    };
  }
  return { response: null, consumed: true };
}

// Best-effort refund of a previously consumed credit (generation failed/empty).
async function refundCredit(supabase: MinimalClient, type: string, period: string): Promise<void> {
  try {
    await supabase.rpc('refund_usage_credit', { p_type: type, p_period: period });
  } catch (e) {
    console.warn('[generate-item-image] credit refund failed:', (e as Error).message);
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return jsonResponse({ ok: true }, 200);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Missing authorization header' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const apiKey = Deno.env.get('GOOGLE_API_KEY');
    if (!apiKey) return jsonResponse({ error: 'GOOGLE_API_KEY not configured' }, 503);

    const body = await req.json().catch(() => ({}));
    const { photo_uri, notes } = body as { photo_uri?: string; notes?: string };
    if (!photo_uri || typeof photo_uri !== 'string') {
      return jsonResponse({ error: 'photo_uri required (base64 data URI)' }, 400);
    }

    let image: GeminiPart;
    try { image = parseImage(photo_uri); }
    catch (e) { return jsonResponse({ error: (e as Error).message }, 400); }

    // Credit gate AFTER input validation so a malformed request never burns a
    // credit. The credit is consumed atomically here (before the slow Gemini
    // call, so the monthly cap can't be raced) and refunded below if the
    // generation yields nothing or throws.
    const period = monthPeriod();
    const gate = await gateCredit(supabase, 'ai_extraction', period);
    if (gate.response) return gate.response;

    // Load the user's OWN body measurements (best-effort, RLS-scoped to them) so
    // the detector can use the wearer's body as a real-world scale when the photo
    // shows the user wearing the items — far better garment-size estimates. Absent
    // profile / any failure → null (the prompt simply omits the scale reference).
    let bodyScale: string | null = null;
    try {
      const { data: bm } = await supabase
        .from('body_measurements').select('*').eq('user_id', user.id).single();
      bodyScale = formatBodyScale(bm as BodyScale | null);
    } catch (_e) { /* no measurements → estimate from typical sizing */ }

    try {
      // Step 1 — detect + snap to controlled vocab
      const rawJson = await geminiDetect(apiKey, image, notes, bodyScale);
      let garments = parseGarments(rawJson);
      if (garments.length === 0) {
        // Nothing detected → not a result the user can use; don't charge for it.
        if (gate.consumed) await refundCredit(supabase, 'ai_extraction', period);
        return jsonResponse({ items: [] }, 200);
      }

      // Bound the fan-out: one paid gemini-3-pro-image-preview call per garment
      // below. Never silently discard — log how many were dropped so the
      // truncation is visible in server logs. Dropped garments simply don't
      // appear in the response (the client sees fewer items than were on the
      // photo, not an error).
      if (garments.length > MAX_GARMENTS_PER_PHOTO) {
        const dropped = garments.length - MAX_GARMENTS_PER_PHOTO;
        console.log(
          `[generate-item-image] truncating garments ${garments.length} -> ${MAX_GARMENTS_PER_PHOTO} (dropped ${dropped})`,
        );
        garments = garments.slice(0, MAX_GARMENTS_PER_PHOTO);
      }

      // Ensure any new colours the AI used exist in the `colors` lookup table so the
      // client can Add the item without an FK violation and the engine can score it.
      // Uses the service role (the table is read-only to users via RLS). Best-effort.
      await ensureColors(garments);

      // Step 2 — isolate each garment in parallel; preserve order (pairing contract).
      // The item is generated on a uniform chroma background (colour chosen to
      // contrast with the garment) and keyed out server-side into a transparent PNG.
      const items: ExtractedItemWithImage[] = await Promise.all(
        garments.map(async (metadata) => {
          const bg = pickChromaBg(metadata.color);
          const img = await geminiIsolate(apiKey, image, metadata, bg, notes);
          if (!img?.data) {
            return { image_data: '', mime_type: 'image/png', metadata, keyed: false };
          }
          const keyed = await keyChroma(img.data, bg);

          // Measured-hex color layer (2026-07-06, additive): decode the FINAL
          // isolated image (background already keyed out when possible) and
          // extract deterministic dominant hex(es) from its real pixels. Never
          // fails the request — any decode error or an ambiguous/empty result
          // simply leaves both hex fields null.
          let primaryHex: string | null = null;
          let secondaryHex: string | null = null;
          try {
            const decoded = await Image.decode(b64ToU8(keyed.data));
            const hexes = dominantHexes(decoded.bitmap, decoded.width, decoded.height);
            primaryHex = hexes.primaryHex;
            secondaryHex = hexes.secondaryHex;
          } catch (e) {
            console.warn('[generate-item-image] hex extraction failed:', (e as Error).message);
          }

          return {
            image_data: keyed.data,
            mime_type: keyed.keyed ? 'image/png' : img.mimeType,
            metadata: { ...metadata, primary_hex: primaryHex, secondary_hex: secondaryHex },
            keyed: keyed.keyed,
          };
        }),
      );

      return jsonResponse({ items }, 200);
    } catch (e) {
      // Generation threw after the credit was consumed → refund, then rethrow to
      // the outer handler for the error response.
      if (gate.consumed) await refundCredit(supabase, 'ai_extraction', period);
      throw e;
    }
  } catch (err) {
    // Surface the real cause (Gemini status/body, payload issue, etc.) so the
    // client and logs show something actionable instead of a generic 500.
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[generate-item-image] Error:', detail);
    const isUpstream = /^Gemini /.test(detail);
    return jsonResponse(
      { error: isUpstream ? 'Image service error' : 'Internal server error', detail },
      isUpstream ? 502 : 500,
    );
  }
});

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
