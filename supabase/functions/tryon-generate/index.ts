// Edge Function: tryon-generate  (feature 009 — AI try-on "wear on you")
// POST /functions/v1/tryon-generate
// Auth: Bearer token (Supabase JWT). Requires GOOGLE_API_KEY secret.
//
// Renders the user wearing a given outfit: feeds the user's photo + each
// garment's reference image to gemini-3-pro-image-preview (nano banana 2),
// preserving the person's identity/pose/body while REPLACING the original
// photo's background with a clean, editorial studio backdrop (luxury-minimalist
// tone) to showcase the outfit. A detailed person profile (gender/age/body
// measurements/shape/fit preference) is passed as TEXT to guide body proportions
// and garment fit — never to alter the face/skin/hair, which must match the photo.
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
function profileLines(p?: Profile): string[] {
  if (!p) return [];
  const lines: string[] = [];
  if (p.gender) lines.push(`Gender: ${p.gender}`);
  if (typeof p.age === 'number' && p.age > 0) lines.push(`Age: ${p.age}`);
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

  // Derived proportion descriptors (2026-07-03): raw centimetres are a weak
  // signal for an image model — verbal build/proportion cues anchor stature and
  // leg length far better, so state them explicitly alongside the numbers.
  if (typeof p.height_cm === 'number' && p.height_cm > 0 && typeof p.weight_kg === 'number' && p.weight_kg > 0) {
    const bmi = p.weight_kg / Math.pow(p.height_cm / 100, 2);
    const build = bmi < 18.5 ? 'slim' : bmi < 23 ? 'lean' : bmi < 27.5 ? 'average' : bmi < 32 ? 'solid' : 'full';
    lines.push(`Overall build: ${build} (BMI ${bmi.toFixed(1)})`);
  }
  const inseam = m && typeof m.inseam === 'number' ? m.inseam : undefined;
  if (typeof p.height_cm === 'number' && p.height_cm > 0 && typeof inseam === 'number' && inseam > 0) {
    const ratio = inseam / p.height_cm;
    const legs = ratio >= 0.47 ? 'long' : ratio >= 0.44 ? 'balanced' : 'shorter';
    lines.push(`Leg proportion: inseam is ${(ratio * 100).toFixed(0)}% of height (${legs} legs)`);
  }
  return lines;
}

// Human-readable OUTFIT CONTEXT line — title/style/occasion from the outfit the
// garments were pulled from. Purely a styling/mood cue for the render (framing,
// setting, expression); it must never override the garment list or profile above.
function contextLine(ctx?: OutfitContext): string {
  if (!ctx) return '';
  const parts = [ctx.title, ctx.style, ctx.occasion].filter((v): v is string => Boolean(v && v.trim()));
  return parts.length ? `Outfit context: ${parts.join(' — ')}.` : '';
}

function buildGenPrompt(garments: Garment[], profile?: Profile, context?: OutfitContext): string {
  const list = garments.map(describeGarment).join('\n');
  const pl = profileLines(profile);
  const profileBlock = pl.length
    ? [
        '',
        'PERSON PROFILE (use ONLY to render correct body proportions and how each garment fits/drapes on THIS body — length, tightness, silhouette. Do NOT use it to change the face, skin tone, hair, or identity):',
        ...pl.map((l) => `- ${l}`),
      ].join('\n')
    : '';
  const ctxLine = contextLine(context);

  return [
    'You are a virtual try-on image generator.',
    'The FIRST image is a real photo of a person. The images that follow are reference photos of clothing garments.',
    'Generate ONE photorealistic image of the SAME person from the first photo, now wearing the full outfit made of these garments:',
    list,
    ctxLine,
    profileBlock,
    '',
    'Strict requirements:',
    '- FACE IDENTITY IS THE #1 PRIORITY — ABSOLUTE: the generated person\'s face must be the SAME individual as the first photo, unmistakably recognisable. Copy the exact face — same facial features, bone structure, eyes, nose, mouth, jawline, skin tone, complexion, hair and hairline. Do NOT regenerate, redraw, resynthesise, swap, beautify, slim, smooth, re-age, or "improve" the face in any way. Preserve identity, skin tone, hair, body and pose exactly as in the first photo; do not restyle them. If preserving the face perfectly conflicts with ANY other instruction below (framing, angle, proportions, background), PRESERVING THE FACE WINS.',
    '- BACKGROUND: replace the original photo\'s background entirely with a clean, seamless STUDIO backdrop — a smooth warm-neutral / off-white / soft stone-grey wall (editorial fashion studio, minimalist luxury tone), evenly lit. Remove any clutter, rooms, outdoor scenery, or objects from the original photo. Keep ONLY the person. Replace only the surrounding environment — the person\'s face and head must remain exactly as in the source photo.',
    '- Preserve the person\'s pose, body, face, skin, hair and identity EXACTLY while changing only the surrounding environment to the studio backdrop. Relight the scene as soft, even studio lighting that flatters the outfit, with realistic contact shadows on the floor.',
    '- Dress them in the provided garments faithfully (shape, colour, material, length). Layer naturally (outerwear over tops, etc.).',
    '- Fit and drape must match the person profile: realistic contact shadows and soft studio lighting as described above.',
    '- STATURE, BUILD & PROPORTIONS: render the body to match the PERSON PROFILE\'s exact height, weight, body shape and every listed body measurement (chest/waist/hip/shoulder/inseam/etc.) — the silhouette, girth and limb length must reflect THIS person\'s real frame, not an idealised or average fashion-model body. For parts not visible in the source photo, extrapolate to the stated height and inseam. Present that real frame with the flattering editorial framing described below — truthful proportions, flattering posture — without altering the face (see face rule above).',
    '- FRAMING & COMPOSITION (maximise perceived HEIGHT through body composition only, never through the face): compose as a FULL-LENGTH head-to-toe editorial fashion shot in a TALL VERTICAL/PORTRAIT frame (not square, not waist-up) — feet planted at or near the BOTTOM edge of the frame with only minimal headroom above the head, so the body fills the vertical frame edge-to-edge. Render a LONG, elongated leg line as the dominant vertical element of the composition — long legs and an elongated lower body the way high-fashion editorial photography stretches stature, giving a tall, statuesque silhouette. Posture must be upright, stretched and elegant: spine long, shoulders back, standing tall — no slouching, and no bent knees that would shorten the leg line. Do NOT foreshorten or vertically compress the body, and do NOT render the body from a high/downward viewpoint that would shorten it. This is a flattering presentation of THEIR real build — keep the body girths and proportions from the PERSON PROFILE truthful; elongate the leg line and posture for a taller read, but do not distort a heavier or shorter build into a thinner or different body. IMPORTANT — reconcile with the face rule above: all of this elongation (leg line, posture, vertical framing) applies ONLY to the body, legs and overall composition. Keep the head and face at the SAME angle, orientation and rendering as the source photo — do NOT turn, tilt, re-pose, re-angle, re-light, or vertically stretch the face or head to achieve this, and do NOT change the camera angle on the head. Flatter stature through the body\'s posture, leg line and full-length vertical framing only, never by altering the face — if there is ever a conflict, the face rule wins.',
    '- Do NOT add text, watermarks, logos, extra people, or accessories that were not provided.',
    ctxLine
      ? '- The outfit context above (title/style/occasion) is a styling cue ONLY — it may inform how the garments are worn (e.g. tucked, layered, buttoned) but must NEVER add props, extra people, text, or any scenery beyond the plain studio backdrop.'
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

// ─── Credit gate helper ───────────────────────────────────────────────────────

interface MinimalClient {
  from: (table: string) => { select: (col: string) => { single: () => Promise<{ data: unknown }> } };
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
}

function monthPeriod(): string {
  return new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1),
  ).toISOString().slice(0, 10);
}

// Atomically consume one credit (premium/demo bypass). Returns a 402 Response
// when exhausted, plus whether a credit was actually consumed so the caller can
// refund it if the generation later fails.
async function gateCredit(
  supabase: MinimalClient,
  type: string,
  period: string,
): Promise<{ response: Response | null; consumed: boolean }> {
  try {
    const { data: prof } = await supabase.from('profiles').select('account_type').single();
    const accountType = (prof as { account_type?: string } | null)?.account_type;
    if (accountType === 'premium' || accountType === 'demo') return { response: null, consumed: false };
  } catch {
    // profile fetch failure → fail open
  }

  const { data: gate, error: gateErr } = await supabase.rpc('consume_usage_credit', {
    p_type: type,
    p_period: period,
    p_limit: 2,
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

      return json({ image_data: img.data, mime_type: img.mimeType }, 200);
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
