// Edge Function: tryon-validate  (feature 009 — AI try-on "wear on you")
// POST /functions/v1/tryon-validate
// Auth: Bearer token (Supabase JWT). Requires GOOGLE_API_KEY secret.
//
// Cheap GATE before the expensive image generation: confirm the uploaded photo
// shows ONE clear human subject, visible head-to-toe, that we can dress. Runs
// gemini-2.5-flash (vision → text) and returns a small JSON verdict the client
// uses to either proceed or ask the user to pick another photo.
//
// Full-body requirement (2026-08-08): the try-on result must show the user's
// real body at its real proportions, and edit-in-place can only do that by
// preserving whatever framing is already in the source photo — it cannot
// safely invent unseen legs/feet. So a half-body photo is rejected here,
// before the expensive generation call, rather than producing a cropped or
// fabricated result downstream.
//
// Input:  { photo_uri: string (base64 data URI of the user's photo) }
// Output: { valid: boolean, reason: string }
//   valid=true  → a single, clearly-visible person → safe to generate.
//   valid=false → reason is a short, user-facing explanation (why to re-pick).
//
// PRIVACY: the photo is sent to Gemini for this single call only. On the PAID
// Gemini tier prompts/responses are NOT used for training (logged briefly for
// abuse/safety only). The GOOGLE_API_KEY's project MUST be billing-enabled.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const VISION_MODEL = 'gemini-2.5-flash';
const TIMEOUT_MS = 12000;

const SYSTEM = `You are a strict image gate for a virtual clothing try-on feature. You are shown ONE photo. Decide whether it is suitable for rendering an outfit onto the person.

Return ONLY a JSON object (no prose, no markdown fences):
{"is_person": boolean, "single_subject": boolean, "body_visible": boolean, "full_body_visible": boolean, "quality_ok": boolean, "reason": string}

Rules:
- is_person: true only if there is a real, photographed human (not illustration, mannequin, doll, statue, or AI avatar).
- single_subject: true only if exactly ONE person is the clear primary subject. Multiple prominent people → false.
- body_visible: true if at least the upper body / torso is visible and unobstructed enough to place clothing on. A tiny/distant figure or a face-only crop → false.
- full_body_visible: true only if the person is visible head-to-toe — the whole figure is in frame, including legs and feet/shoes. Cropped at the waist, thighs, or knees → false, even if body_visible is true.
- quality_ok: true if the photo is in focus and well-lit enough to use. Heavy blur, extreme darkness, or strong occlusion → false.
- reason: ONE short sentence (max ~90 chars) in Vietnamese explaining the main problem if any field is false — if the person isn't visible head-to-toe, say so; empty string if everything is fine.

Be conservative: if unsure whether a clear single person is present, set is_person or single_subject to false.`;

interface GeminiPart { text?: string; inlineData?: { mimeType: string; data: string } }

function parseImage(photoUri: string): GeminiPart {
  if (!photoUri.startsWith('data:')) {
    throw new Error('photo_uri must be a base64 data URI (data:image/...;base64,...)');
  }
  const comma = photoUri.indexOf(',');
  const mimeType = photoUri.slice(0, comma).replace('data:', '').replace(';base64', '');
  return { inlineData: { mimeType, data: photoUri.slice(comma + 1) } };
}

interface Verdict {
  is_person?: boolean; single_subject?: boolean;
  body_visible?: boolean; full_body_visible?: boolean; quality_ok?: boolean; reason?: string;
}

function parseVerdict(raw: string): Verdict {
  try {
    const cleaned = raw.replace(/```(?:json)?\n?/g, '').replace(/```\n?/g, '').trim();
    const obj = JSON.parse(cleaned);
    return (obj && typeof obj === 'object') ? obj as Verdict : {};
  } catch {
    return {};
  }
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

    // Rate-limit (audit 2026-07-03): this endpoint had no gate at all — a
    // scripted free account could burn unbounded Gemini vision calls, since
    // the real credit gate only lives in tryon-generate downstream. Hard-gate
    // here (unlike generate-outfits' curate_feed, which falls back silently,
    // there's no cheaper fallback for a validation call — reject on budget).
    // RPC failure fails open (best-effort limiter, not the primary defense).
    try {
      const { data: ok } = await supabase.rpc('consume_rate_limit', {
        p_bucket: 'tryon_validate', p_max: 30, p_window_secs: 3600,
      });
      if (ok === false) {
        return json({ error: 'Too many validation requests. Please try again later.' }, 429);
      }
    } catch (_e) { /* fail open — best-effort limiter */ }

    const apiKey = Deno.env.get('GOOGLE_API_KEY');
    if (!apiKey) return json({ error: 'GOOGLE_API_KEY not configured' }, 503);

    const body = await req.json().catch(() => ({}));
    const { photo_uri } = body as { photo_uri?: string };
    if (!photo_uri || typeof photo_uri !== 'string') {
      return json({ error: 'photo_uri required (base64 data URI)' }, 400);
    }

    let image: GeminiPart;
    try { image = parseImage(photo_uri); }
    catch (e) { return json({ error: (e as Error).message }, 400); }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${GEMINI_BASE}/${VISION_MODEL}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
        signal: ctrl.signal,
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM }] },
          contents: [{ parts: [image, { text: 'Evaluate this photo. Return ONLY the JSON verdict.' }] }],
          generationConfig: { responseModalities: ['TEXT'], temperature: 0, thinkingConfig: { thinkingBudget: 0 } },
        }),
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      console.warn('[tryon-validate] gemini', res.status, detail);
      return json({ error: 'Validation service error', detail }, 502);
    }

    const data = await res.json();
    const text: string = data.candidates?.[0]?.content?.parts?.find((p: GeminiPart) => p.text)?.text ?? '';
    const v = parseVerdict(text);

    const valid = v.is_person === true && v.single_subject === true
      && v.body_visible === true && v.full_body_visible === true && v.quality_ok === true;

    // Default user-facing reason when the model returned none.
    let reason = (typeof v.reason === 'string' && v.reason.trim()) ? v.reason.trim() : '';
    if (!valid && !reason) {
      reason = v.is_person !== true
        ? 'Không nhận diện được người trong ảnh. Hãy chọn ảnh có người thật rõ ràng.'
        : v.single_subject !== true
          ? 'Ảnh có nhiều người. Hãy chọn ảnh chỉ có một mình bạn.'
          : v.body_visible !== true
            ? 'Cần thấy rõ phần thân trên. Hãy chọn ảnh chụp xa hơn một chút.'
            : v.full_body_visible !== true
              ? 'Cần thấy toàn thân từ đầu đến chân, kể cả bàn chân. Hãy chọn ảnh chụp toàn thân.'
              : 'Ảnh chưa đủ rõ nét. Hãy chọn ảnh sáng và rõ hơn.';
    }

    return json({ valid, reason }, 200);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[tryon-validate] Error:', detail);
    return json({ error: 'Internal server error', detail }, 500);
  }
});

function json(d: unknown, s: number): Response {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
