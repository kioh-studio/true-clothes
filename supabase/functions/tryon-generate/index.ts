// Edge Function: tryon-generate  (feature 009 — AI try-on "wear on you")
// POST /functions/v1/tryon-generate
// Auth: Bearer token (Supabase JWT). Requires GOOGLE_API_KEY secret.
//
// Renders the user wearing a given outfit: feeds the user's photo + each
// garment's reference image to gemini-3-pro-image-preview (nano banana 2),
// preserving the person's identity/pose/background. A detailed person profile
// (gender/age/body measurements/shape/fit preference) is passed as TEXT to guide
// body proportions and garment fit — never to alter the face/skin/hair, which
// must match the photo.
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseDataUri(uri: string): GeminiPart {
  if (!uri.startsWith('data:')) throw new Error('person_uri must be a base64 data URI');
  const comma = uri.indexOf(',');
  const mimeType = uri.slice(0, comma).replace('data:', '').replace(';base64', '');
  return { inlineData: { mimeType, data: uri.slice(comma + 1) } };
}

function u8ToB64(u8: Uint8Array): string {
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < u8.length; i += CH) {
    bin += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + CH)));
  }
  return btoa(bin);
}

// Fetch a (signed) garment image URL → inline image part. Null on any failure
// (the garment is still described in text so the model knows what to render).
async function fetchImagePart(url: string): Promise<GeminiPart | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) { console.warn('[tryon-generate] garment fetch', res.status); return null; }
    const mimeType = res.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
    if (!mimeType.startsWith('image/')) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > 8_000_000) return null;
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
  return lines;
}

function buildGenPrompt(garments: Garment[], profile?: Profile): string {
  const list = garments.map(describeGarment).join('\n');
  const pl = profileLines(profile);
  const profileBlock = pl.length
    ? [
        '',
        'PERSON PROFILE (use ONLY to render correct body proportions and how each garment fits/drapes on THIS body — length, tightness, silhouette. Do NOT use it to change the face, skin tone, hair, or identity):',
        ...pl.map((l) => `- ${l}`),
      ].join('\n')
    : '';

  return [
    'You are a virtual try-on image generator.',
    'The FIRST image is a real photo of a person. The images that follow are reference photos of clothing garments.',
    'Generate ONE photorealistic image of the SAME person from the first photo, now wearing the full outfit made of these garments:',
    list,
    profileBlock,
    '',
    'Strict requirements:',
    '- Preserve the person EXACTLY as in the first photo: same face, identity, skin tone, hair, body and pose. Do not beautify or restyle them.',
    '- Keep the original background and framing.',
    '- Dress them in the provided garments faithfully (shape, colour, material, length). Layer naturally (outerwear over tops, etc.).',
    '- Fit and drape must match the person profile and the photo: realistic shadows and lighting consistent with the original.',
    '- Do NOT add text, watermarks, logos, extra people, or accessories that were not provided.',
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
      context?: { title?: string; style?: string; occasion?: string };
    };

    if (!body.person_uri || typeof body.person_uri !== 'string') {
      return json({ error: 'person_uri required (base64 data URI)' }, 400);
    }
    const garments = Array.isArray(body.garments) ? body.garments.filter((g) => g && (g.type || g.name)) : [];
    if (garments.length === 0) return json({ error: 'garments required' }, 400);

    let person: GeminiPart;
    try { person = parseDataUri(body.person_uri); }
    catch (e) { return json({ error: (e as Error).message }, 400); }

    // Fetch garment reference images (signed URLs) in parallel, capped.
    const withUrls = garments.filter((g) => typeof g.image_url === 'string').slice(0, MAX_GARMENT_IMAGES);
    const imageParts = (await Promise.all(withUrls.map((g) => fetchImagePart(g.image_url!)))).filter(
      (p): p is GeminiPart => p !== null,
    );

    const parts: GeminiPart[] = [person, ...imageParts, { text: buildGenPrompt(garments, body.profile) }];

    const img = await generateImage(apiKey, parts);
    if (!img?.data) return json({ error: 'Could not generate the try-on image. Please try again.' }, 502);

    return json({ image_data: img.data, mime_type: img.mimeType }, 200);
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
