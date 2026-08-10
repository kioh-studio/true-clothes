// Edge Function: tryon-generate  (feature 009 — AI try-on "wear on you")
// POST /functions/v1/tryon-generate
// Auth: Bearer token (Supabase JWT). Requires GOOGLE_API_KEY secret.
//
// Renders the user wearing a given outfit: feeds the user's photo + each
// garment's reference image to gemini-3-pro-image-preview (nano banana 2),
// EDITING the photo in place — same background, pose, framing, and lighting,
// with only the clothing changed (2026-08-07; previously this regenerated the
// whole image onto a studio backdrop, which was the root cause of face drift).
// A person profile (gender/body measurements/shape/fit preference) is passed
// as TEXT to guide how garments fit/drape on the body ALREADY visible in the
// photo — never to alter the face/skin/hair/pose, which must match the photo.
// The photo must be full-body (gated upstream in tryon-validate) and the
// prompt forbids beautifying the body (slimming, lengthening, reshaping) —
// the real body's size and proportions must come through unchanged.
//
// A post-generate verify pass (2026-08-06, extended 2026-08-08) sends the
// checker BOTH images — the ORIGINAL person photo and the GENERATED result —
// so it can judge by comparison whether the edit preserved identity and body
// truthfulness, not just whether the output looks plausible in isolation.
//
// Input: {
//   person_uri: string,                       // base64 data URI of the user's photo
//   garments: Array<{ type, name?, color?, material?, fit?, image_url? }>,
//   profile?: {
//     gender?: string, age?: number,
//     height_cm?: number, weight_kg?: number,
//     body_shape?: string, preferred_fit?: string,
//     measurements_cm?: Record<string, number>
//   },
//   context?: { title?: string, style?: string, occasion?: string }
// }
// Output: { image_data: string (base64, no prefix), mime_type: string }
//
// PRIVACY: see tryon-validate — paid Gemini tier required; no client image is
// persisted by this function.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const IMAGE_GEN_MODEL = 'gemini-3-pro-image-preview'; // nano banana 2 / Gemini 3 Pro Image
const GEN_TIMEOUT_MS = 45000;
// Post-generate quality verify pass (2026-08-06) — cheap vision model checks
// the GENERATED image before it's accepted. Overridable so a bad default can
// be swapped without a code deploy.
const VERIFY_MODEL = Deno.env.get('TRYON_VERIFY_MODEL') || 'gemini-2.5-flash';
const VERIFY_TIMEOUT_MS = 10000;
const TRANSIENT = new Set([429, 500, 502, 503, 504]);
const MAX_GARMENT_IMAGES = 6;
const MAX_IMAGE_BYTES = 8_000_000; // shared cap: person photo + each garment reference image

interface GeminiPart { text?: string; inlineData?: { mimeType: string; data: string } }
interface GeminiResponse { candidates?: Array<{ content?: { parts?: GeminiPart[] } }> }

interface Garment {
  type?: string; name?: string; color?: string; material?: string; fit?: string; image_url?: string;
}

interface Profile {
  gender?: string;
  age?: number;
  height_cm?: number;
  weight_kg?: number;
  body_shape?: string;
  preferred_fit?: string;
  measurements_cm?: Record<string, number>;
}

interface OutfitContext {
  title?: string;
  style?: string;
  occasion?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Estimated decoded byte length of a base64 payload — avoids a full atob() decode
// just to size-check (cheap, no huge intermediate string for large photos).
function b64ByteLength(b64: string): number {
  const len = b64.length;
  if (len === 0) return 0;
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((len * 3) / 4) - padding;
}

// Same cap as the garment reference images (MAX_IMAGE_BYTES) plus an image/* mime
// check — previously ungated, so an oversized/non-image person_uri sailed straight
// into the Gemini call.
function parseDataUri(uri: string): GeminiPart {
  if (!uri.startsWith('data:')) throw new Error('person_uri must be a base64 data URI');
  const comma = uri.indexOf(',');
  if (comma === -1) throw new Error('person_uri must be a base64 data URI');
  const mimeType = uri.slice(0, comma).replace('data:', '').replace(';base64', '');
  if (!mimeType.startsWith('image/')) throw new Error('person_uri must be an image');
  const data = uri.slice(comma + 1);
  if (b64ByteLength(data) > MAX_IMAGE_BYTES) {
    throw new Error('person_uri exceeds max image size (8MB)');
  }
  return { inlineData: { mimeType, data } };
}

function u8ToB64(u8: Uint8Array): string {
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < u8.length; i += CH) {
    bin += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + CH)));
  }
  return btoa(bin);
}

// SSRF guard: only the project's own Supabase Storage may be fetched server-side.
// Garment image_urls are always signed Storage URLs; anything else (internal IPs,
// cloud-metadata endpoints, arbitrary hosts) is rejected before any network call.
function isAllowedImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    const base = Deno.env.get('SUPABASE_URL');
    if (!base) return false;
    return u.host === new URL(base).host && u.pathname.startsWith('/storage/');
  } catch {
    return false;
  }
}

// Fetch a (signed) garment image URL → inline image part. Null on any failure
// (the garment is still described in text so the model knows what to render).
async function fetchImagePart(url: string): Promise<GeminiPart | null> {
  if (!isAllowedImageUrl(url)) {
    console.warn('[tryon-generate] blocked non-allowlisted image_url');
    return null;
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    // redirect:'error' — an allowlisted host must not bounce us elsewhere (matches
    // the curator's fetchCuratorImage / backfill-item-metadata pattern; without
    // this, isAllowedImageUrl's host check can be defeated by a same-host redirect
    // to an arbitrary off-allowlist location).
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'error' });
    clearTimeout(t);
    if (!res.ok) { console.warn('[tryon-generate] garment fetch', res.status); return null; }
    const mimeType = res.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
    if (!mimeType.startsWith('image/')) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_IMAGE_BYTES) return null;
    return { inlineData: { mimeType, data: u8ToB64(buf) } };
  } catch (e) {
    console.warn('[tryon-generate] garment fetch threw:', (e as Error).message);
    return null;
  }
}

function describeGarment(g: Garment, i: number): string {
  const attrs = [g.color, g.material, g.fit ? `${g.fit} fit` : null].filter(Boolean).join(', ');
  const label = g.name || g.type || `item ${i + 1}`;
  const kind = g.type && g.name ? ` (${g.type.toLowerCase()})` : '';
  return `${i + 1}. ${label}${kind}${attrs ? ` — ${attrs}` : ''}`;
}

// Human-readable PERSON PROFILE lines. Empty array if nothing useful is provided.
//
// Edit-in-place rewrite (2026-08-07): this used to feed a from-scratch body
// synthesis (studio backdrop, full-body re-render), so it carried derived
// descriptors (BMI-based "build", inseam/height leg-proportion ratio, age)
// meant to help the model INVENT a body it couldn't otherwise see. Now the
// real body is already present in the source photo — far more accurate than
// any of those derived cues — so this list exists ONLY to describe how
// garments should fit/drape on that already-visible body. Age dropped
// entirely (never affected fit) and the two derived proportion lines dropped
// (they actively invited re-rendering the body/legs).
function profileLines(p?: Profile): string[] {
  if (!p) return [];
  const lines: string[] = [];
  if (p.gender) lines.push(`Gender: ${p.gender}`);
  const hw = [
    typeof p.height_cm === 'number' ? `height ${p.height_cm} cm` : null,
    typeof p.weight_kg === 'number' ? `weight ${p.weight_kg} kg` : null,
  ].filter(Boolean).join(', ');
  if (hw) lines.push(`Build: ${hw}`);
  if (p.body_shape) lines.push(`Body shape: ${p.body_shape}`);
  if (p.preferred_fit) lines.push(`Preferred fit: ${p.preferred_fit}`);
  const m = p.measurements_cm;
  if (m && typeof m === 'object') {
    const parts = Object.entries(m)
      .filter(([, v]) => typeof v === 'number' && v > 0)
      .map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`);
    if (parts.length) lines.push(`Body measurements (cm): ${parts.join(', ')}`);
  }
  return lines;
}

// Human-readable OUTFIT CONTEXT line — title/style/occasion from the outfit the
// garments were pulled from. Purely a cue for HOW the garments are worn (tucked,
// layered, buttoned); it must never override the garment list or profile above.
// Since the edit-in-place rewrite it must NOT influence framing, setting, or
// expression either — those all stay exactly as the source photo has them.
function contextLine(ctx?: OutfitContext): string {
  if (!ctx) return '';
  const parts = [ctx.title, ctx.style, ctx.occasion].filter((v): v is string => Boolean(v && v.trim()));
  return parts.length ? `Outfit context: ${parts.join(' — ')}.` : '';
}

// Edit-in-place rewrite (2026-08-07): the previous prompt told the model to
// GENERATE a new image — same person, but with the background replaced by a
// studio backdrop, a re-angled/elongated full-length frame, and body
// proportions extrapolated from measurements. Those instructions are
// mutually incompatible with "preserve the face exactly": swapping the
// background and re-composing the frame forces the model to resynthesise
// the whole image, and the face is the first thing that drifts. This
// version frames the task as EDITING the supplied photo — change only the
// clothing, keep literally everything else (background, pose, framing,
// lighting, face) as it already is in the source.
function buildGenPrompt(garments: Garment[], profile?: Profile, context?: OutfitContext): string {
  const list = garments.map(describeGarment).join('\n');
  const pl = profileLines(profile);
  const profileBlock = pl.length
    ? [
        '',
        'PERSON PROFILE (use ONLY to judge how the garments should fit and drape on THIS body — ease, tightness, length, whether a piece should read fitted or oversized. Do NOT use it to alter the person\'s body, proportions, pose, or face — the real body is already visible in the photo, which is a far more accurate reference than these numbers):',
        ...pl.map((l) => `- ${l}`),
      ].join('\n')
    : '';
  const ctxLine = contextLine(context);

  return [
    'You are a virtual try-on photo EDITOR, not an image generator.',
    'The FIRST image is a real photo to EDIT. The images that follow are reference photos of clothing garments.',
    'Edit the first photo so the person is wearing the full outfit made of these garments, changing ONLY the clothing:',
    list,
    ctxLine,
    profileBlock,
    '',
    'Strict requirements:',
    '- THIS IS AN EDIT, NOT A NEW IMAGE: change ONLY the clothing the person is wearing. Everything else in the first photo must remain identical — the background and surroundings, the person\'s pose and body position, the camera angle and distance, the crop/framing/aspect ratio of the shot, and the lighting and shadows already in the scene. Do not recompose, re-crop, zoom, or reframe the shot.',
    '- FACE IDENTITY IS THE #1 PRIORITY — ABSOLUTE: the head and face must NOT be re-rendered, re-lit, re-angled, beautified, slimmed, smoothed, or re-aged in any way. Copy the exact face — same facial features, bone structure, eyes, nose, mouth, jawline, skin tone, complexion, hair, and hairline — pixel-faithful to the source photo. Also preserve the person\'s hands exactly. If preserving the face/hands perfectly conflicts with ANY other instruction below, PRESERVING THE FACE AND HANDS WINS.',
    '- TRUE BODY SIZE IS THE #2 PRIORITY — ABSOLUTE: the person\'s body must keep its exact real size, shape, and proportions from the source photo. Do NOT slim, slenderise, lengthen, heighten, broaden, narrow, tone, or otherwise flatter the body. Do not lengthen or straighten the legs, do not narrow the waist or hips, do not change shoulder width or arm/thigh thickness, and do not alter posture or stance. Every body outline and proportion must stay pixel-faithful to the source photo — only the clothing covering the body changes. This matters because the user needs to see how these clothes genuinely look on their real body: an idealised or flattering figure defeats the entire purpose of this feature and is a failure. The full extent of the body visible in the source photo must remain visible in the result — if the source is a head-to-toe shot, the result stays head-to-toe, with feet and footwear still in frame and nothing cropped away.',
    '- Dress them in the provided garments faithfully (shape, colour, material, length). Layer naturally (outerwear over tops, etc.).',
    '- The new clothing must sit on the body with correct occlusion, drape, folds, and contact shadows consistent with the EXISTING lighting in the photo — do not invent new lighting.',
    '- Do NOT add text, watermarks, logos, extra people, or accessories that were not provided.',
    ctxLine
      ? '- The outfit context above (title/style/occasion) is a styling cue ONLY — it may inform how the garments are worn (e.g. tucked, layered, buttoned) but must NEVER add props, extra people, text, or change the setting/background in any way.'
      : '',
    'Output a single image only.',
  ].join('\n');
}

async function generateImage(apiKey: string, parts: GeminiPart[]): Promise<{ data: string; mimeType: string } | null> {
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: { responseModalities: ['IMAGE'] },
  });
  let lastErr = 'image generation failed';
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), GEN_TIMEOUT_MS);
    try {
      const res = await fetch(`${GEMINI_BASE}/${IMAGE_GEN_MODEL}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
        signal: ctrl.signal,
        body,
      });
      clearTimeout(t);
      if (res.ok) {
        const data: GeminiResponse = await res.json();
        const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
        if (part?.inlineData) return { data: part.inlineData.data, mimeType: part.inlineData.mimeType };
        lastErr = 'Gemini returned no image';
        return null; // a 200 with no image won't be fixed by retrying
      }
      lastErr = `Gemini image ${res.status}: ${(await res.text()).slice(0, 300)}`;
      if (!TRANSIENT.has(res.status)) break;
    } catch (e) {
      clearTimeout(t);
      lastErr = `Gemini image network: ${(e as Error).message}`;
    }
    await sleep(800 * (attempt + 1));
  }
  throw new Error(lastErr);
}

// ─── Post-generate quality verify pass ────────────────────────────────────────
//
// Today a 200-with-an-image was accepted unconditionally — bad anatomy or a
// missing/wrong garment still billed a credit and reached the screen. This
// runs a cheap vision check AFTER generation and reports whether it looks
// right. Since the edit-in-place rewrite, "looks right" includes whether the
// edit actually preserved identity and body truthfulness — which can only be
// judged by comparison, so the checker is sent BOTH images: the ORIGINAL
// person photo first, then the GENERATED result, explicitly labelled in the
// prompt so the model knows which is which and compares the second against
// the first. FAIL-OPEN by design: any error, timeout, or unparseable
// response is treated as a pass — the checker must never block a paid
// generation the user is waiting on. Only an explicit `false` verdict field
// counts against the image. (A false verdict refunds the credit and shows a
// quality warning — see the handler below — so this extra strictness costs
// the user nothing; it gives them a free retry.)

interface VerifyVerdict {
  person_ok?: boolean; garments_ok?: boolean; anatomy_ok?: boolean;
  identity_ok?: boolean; body_ok?: boolean;
}

function parseVerifyVerdict(raw: string): VerifyVerdict {
  try {
    const cleaned = raw.replace(/```(?:json)?\n?/g, '').replace(/```\n?/g, '').trim();
    const obj = JSON.parse(cleaned);
    return (obj && typeof obj === 'object') ? obj as VerifyVerdict : {};
  } catch {
    return {};
  }
}

function buildVerifyPrompt(garments: Garment[]): string {
  const list = garments.map(describeGarment).join('\n');
  return [
    'You are a strict quality gate for an AI-generated virtual clothing try-on EDIT.',
    'You are shown TWO images: the FIRST image is the original photo, the SECOND is the edited result — the same person, digitally re-dressed in a new outfit.',
    'The outfit should include these garments:',
    list,
    '',
    'Return ONLY a JSON object (no prose, no markdown fences):',
    '{"person_ok": boolean, "garments_ok": boolean, "anatomy_ok": boolean, "identity_ok": boolean, "body_ok": boolean}',
    '',
    'Rules:',
    '- person_ok: true only if there is one clearly identifiable MAIN SUBJECT in the second image whose face is clearly visible. Incidental people in the background (bystanders, passers-by) do NOT count against this — the source photo may have been taken in a public place.',
    '- garments_ok: true only if the garments listed above are visibly worn by the person in the second image (type, shape, colour reasonably match).',
    '- anatomy_ok: true only if the body in the second image looks anatomically normal — no extra/missing/deformed limbs, hands, or fingers.',
    '- identity_ok: true only if the person in the second image is unmistakably the SAME individual as the person in the first image (same face, same identity).',
    '- body_ok: true only if the body\'s size, shape, proportions, posture, and the framing/crop in the second image match the first image — the figure must NOT have been slimmed, lengthened, reshaped, re-posed, or re-cropped compared to the original.',
    'Be conservative: if unsure about any field, set it to false.',
  ].join('\n');
}

// Returns true when the image passes (or the checker itself failed/timed out
// — fail-open). Returns false only when the model explicitly flagged a field.
// `person` is the original source photo part (already parsed by the caller)
// so the checker can compare the edit against it instead of judging the
// generated image in isolation.
async function verifyGeneratedImage(
  apiKey: string,
  person: GeminiPart,
  imageData: string,
  mimeType: string,
  garments: Garment[],
): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), VERIFY_TIMEOUT_MS);
  try {
    const res = await fetch(`${GEMINI_BASE}/${VERIFY_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
      signal: ctrl.signal,
      body: JSON.stringify({
        contents: [{
          parts: [
            person,
            { inlineData: { mimeType, data: imageData } },
            { text: buildVerifyPrompt(garments) },
          ],
        }],
        generationConfig: { responseModalities: ['TEXT'], temperature: 0, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });
    if (!res.ok) {
      console.warn('[tryon-generate] verify gemini', res.status);
      return true; // fail-open
    }
    const data: GeminiResponse = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text ?? '';
    const v = parseVerifyVerdict(text);
    // Missing/unparseable fields default to "ok" (fail-open) — only an
    // explicit `false` from the model counts as a failure. identity_ok/body_ok
    // are included here too: a false verdict only costs a refund + free
    // retry (see call site), never a hard block, so the added strictness is
    // safe even though these two checks are new and unproven in production.
    return v.person_ok !== false && v.garments_ok !== false && v.anatomy_ok !== false
      && v.identity_ok !== false && v.body_ok !== false;
  } catch (e) {
    console.warn('[tryon-generate] verify call failed (fail-open):', (e as Error).message);
    return true;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Credit gate helper ───────────────────────────────────────────────────────

// Credit limits (2026-08-05). Source of truth: src/services/usageCreditService.ts
// (FREE_LIMITS / PREMIUM_LIMITS). Edge functions can't import from src/, so these
// are duplicated by hand — no shared cross-function module exists yet under
// supabase/functions/ for this. Keep both copies (here and in generate-item-image/
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
// quota instead of bypassing the check entirely: this action calls
// gemini-3-pro-image-preview at ~$0.13/image, so marginal cost was previously
// unbounded for a premium subscriber. Returns a 402 Response when exhausted,
// plus whether a credit was actually consumed so the caller can refund it if
// the generation later fails.
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
    console.warn('[tryon-generate] credit gate RPC error (fail open):', gateErr.message);
    return { response: null, consumed: false };
  }
  const g = gate as { allowed: boolean; used: number; limit: number } | null;
  if (g && g.allowed === false) {
    return {
      response: json({ error: 'credit_exhausted', credit_type: type, used: g.used, limit: g.limit }, 402),
      consumed: false,
    };
  }
  return { response: null, consumed: true };
}

// Best-effort refund of a previously consumed credit (generation failed).
async function refundCredit(supabase: MinimalClient, type: string, period: string): Promise<void> {
  try {
    await supabase.rpc('refund_usage_credit', { p_type: type, p_period: period });
  } catch (e) {
    console.warn('[tryon-generate] credit refund failed:', (e as Error).message);
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true }, 200);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401);

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    const apiKey = Deno.env.get('GOOGLE_API_KEY');
    if (!apiKey) return json({ error: 'GOOGLE_API_KEY not configured' }, 503);

    const body = await req.json().catch(() => ({})) as {
      person_uri?: string; garments?: Garment[]; profile?: Profile;
      context?: OutfitContext;
    };

    if (!body.person_uri || typeof body.person_uri !== 'string') {
      return json({ error: 'person_uri required (base64 data URI)' }, 400);
    }
    const garments = Array.isArray(body.garments) ? body.garments.filter((g) => g && (g.type || g.name)) : [];
    if (garments.length === 0) return json({ error: 'garments required' }, 400);

    let person: GeminiPart;
    try { person = parseDataUri(body.person_uri); }
    catch (e) { return json({ error: (e as Error).message }, 400); }

    // Credit gate AFTER input validation so a malformed request never burns a
    // credit. Consumed atomically before the slow Gemini call (cap can't be
    // raced); refunded below if generation fails.
    const period = monthPeriod();
    const gate = await gateCredit(supabase, 'try_on', period);
    if (gate.response) return gate.response;

    try {
      // Fetch garment reference images (signed URLs) in parallel, capped.
      const withUrls = garments.filter((g) => typeof g.image_url === 'string').slice(0, MAX_GARMENT_IMAGES);
      const imageParts = (await Promise.all(withUrls.map((g) => fetchImagePart(g.image_url!)))).filter(
        (p): p is GeminiPart => p !== null,
      );

      const parts: GeminiPart[] = [person, ...imageParts, { text: buildGenPrompt(garments, body.profile, body.context) }];

      const img = await generateImage(apiKey, parts);
      if (!img?.data) {
        if (gate.consumed) await refundCredit(supabase, 'try_on', period);
        return json({ error: 'Could not generate the try-on image. Please try again.' }, 502);
      }

      // Post-generate quality verify pass: fail-open, so a checker error never
      // blocks the response — only an explicit bad verdict refunds the credit
      // and flags the result. The image is still returned either way; the
      // user decides whether to keep it or regenerate for free.
      const verifyPassed = await verifyGeneratedImage(apiKey, person, img.data, img.mimeType, garments);
      if (!verifyPassed && gate.consumed) {
        await refundCredit(supabase, 'try_on', period);
      }

      return json(
        { image_data: img.data, mime_type: img.mimeType, ...(verifyPassed ? {} : { quality_warning: true }) },
        200,
      );
    } catch (e) {
      if (gate.consumed) await refundCredit(supabase, 'try_on', period);
      throw e;
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[tryon-generate] Error:', detail);
    const isUpstream = /^Gemini /.test(detail);
    return json({ error: isUpstream ? 'Image service error' : 'Internal server error', detail }, isUpstream ? 502 : 500);
  }
});

function json(d: unknown, s: number): Response {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
