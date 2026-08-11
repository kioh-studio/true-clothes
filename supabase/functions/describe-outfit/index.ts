// Edge Function: describe-outfit  (feature 008 — lazy outfit description)
// POST /functions/v1/describe-outfit
// Auth: Bearer token (Supabase JWT) — same pattern as evaluate-item.
//
// Generates ONE 2–3 sentence editorial description PLUS 3–5 short "how to wear"
// styling tips for a SINGLE outfit, on demand when the user opens the detail
// screen. Kept out of the feed's bulk curation pass (which only ranks + writes
// the one-line note) because generating 10 descriptions at once takes ~10s and
// would block the feed; one description + tips is ~1–2s. Uses Gemini structured
// JSON output (responseSchema) so the two fields come back cleanly separated.
//
// Body: { items: [{ name, type, color, material?, fit? }], styles?: string[],
//         locale?: 'vi'|'en', occasion?: string, weather?: string }
// Response: { description: string, wayToWear: string[] }
//   (empty string / empty array on any AI failure — caller falls back to its own
//    item-list text; this never 500s on AI issues.)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
// flash-lite: for a single short description it reads more editorial (less list-y)
// than full flash, at the same latency and cheaper. Override precedence:
// DESCRIBE_MODEL (call-site) > GEMINI_FLASH_LITE_MODEL (shared cheap-lite-tier
// secret, also used by evaluate-item/note.ts) > this default.
//
// STAYING on gemini-2.5-flash-lite (owner decision, 2026-08-11, cost-first):
// Google's official deprecations table currently shows NO shutdown date for
// this model — exact row: "gemini-2.5-flash-lite | July 22, 2025 | No
// shutdown date announced |". That's unlike gemini-2.5-flash/-pro, which do
// have an announced (Oct 16, 2026) retirement — this -lite tier was never
// actually forced to move. Moving early would have meant paying 2.5x input /
// 3.75x output ($0.10/$0.40 today vs the cheapest upgrade path's $0.25/$1.50)
// to solve a deadline that doesn't apply here. Known upgrade paths, priced
// and dated for when Google does announce a shutdown: gemini-3.1-flash-lite
// ($0.25/M in, $1.50/M out, shuts down itself 2027-05-07) or the longer-lived
// gemini-3.5-flash-lite ($0.30/M in, $2.50/M out, no shutdown announced). The
// real deliverable here is GEMINI_FLASH_LITE_MODEL: the day a shutdown is
// announced for gemini-2.5-flash-lite, migrating is a Supabase secret change
// with no redeploy — no code change needed, just set the env var below.
const DEFAULT_MODEL = Deno.env.get('GEMINI_FLASH_LITE_MODEL') || 'gemini-2.5-flash-lite';
const TIMEOUT_MS = 8000;   // one description + tips ≈ 1–2s; generous headroom, detail screen shows a loader

interface OutfitItem {
  name?: string; type?: string; color?: string; material?: string; fit?: string;
}

type Locale = 'en' | 'vi';
function resolveLocale(l?: string): Locale {
  return l === 'en' ? 'en' : 'vi'; // default Vietnamese (matches the app's primary locale)
}

// Gemini responseSchema (OpenAPI subset): uppercase types, no additionalProperties,
// propertyOrdering to keep the model's field order stable. Mirrors curator.ts.
const DESCRIBE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    description: { type: 'STRING' },
    wayToWear: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['description', 'wayToWear'],
  propertyOrdering: ['description', 'wayToWear'],
} as const;

// Two fully-localised system prompts. We send the prompt in the SAME language we
// want back (not an English prompt with a "write in X" rider) so the copy reads
// natively. `en` param → English copy, `vi` param → Vietnamese copy.
const SYSTEM_PROMPT: Record<Locale, string> = {
  en: `You are a fashion stylist writing the content shown on an outfit's detail screen. You return a JSON object with two fields: "description" and "wayToWear".

description: Given the garments in ONE outfit and the user's styles, write 2–3 sentences (max ~320 characters) of editorial copy: the overall vibe, how the pieces work together (colour/texture/proportion), and the occasion or styling to wear it for. Be specific to the actual garments — do not just list them, and do not invent items that are not present. Write in natural, idiomatic English.

wayToWear: 3–5 SHORT imperative styling tips (each ≤ ~80 characters) telling the user concretely HOW to wear/style THIS specific outfit. Draw from techniques such as: tuck style (full tuck / French (half) tuck / untucked), rolling or pushing up the sleeves, cuffing the trouser hem, layering order, leaving outerwear open, popping a collar, or using a belt to define the waist.
CRITICAL — only suggest a technique when it is genuinely VALID for the actual garments present:
- Never suggest tucking a cropped or oversized top.
- Never suggest rolling short sleeves.
- Only mention layering when there genuinely is outerwear or multiple layers.
- Only mention a belt if an accessory belt is actually in the outfit.
Make the tips weather-aware when weather is given (e.g. roll the sleeves when it is warm). Write each tip in natural, idiomatic English, imperative voice, with no numbering and no preamble inside the string.`,
  vi: `Bạn là một stylist thời trang, viết nội dung hiển thị ở màn hình chi tiết của một bộ trang phục. Bạn trả về một đối tượng JSON gồm hai trường: "description" và "wayToWear".

description: Dựa trên các món đồ trong MỘT bộ trang phục và phong cách của người dùng, hãy viết 2–3 câu (tối đa khoảng 320 ký tự) mang tính biên tập: thần thái tổng thể, cách các món đồ kết hợp với nhau (màu sắc/chất liệu/tỷ lệ), và dịp hoặc cách phối để mặc. Hãy bám sát đúng các món đồ thực tế — đừng chỉ liệt kê, và đừng bịa thêm món không có trong bộ. Viết bằng tiếng Việt tự nhiên, mượt mà.

wayToWear: 3–5 mẹo phối đồ NGẮN GỌN, dạng mệnh lệnh (mỗi mẹo tối đa khoảng 80 ký tự) chỉ cho người dùng cách CỤ THỂ để mặc/phối CHÍNH bộ đồ này. Lấy từ các kỹ thuật như: kiểu sơ vin (sơ vin trọn / sơ vin một phần (kiểu Pháp) / để ngoài), xắn hoặc kéo tay áo lên, gập gấu quần, thứ tự lớp áo, để áo khoác mở, dựng cổ áo, hoặc dùng thắt lưng để tôn eo.
QUAN TRỌNG — chỉ gợi ý một kỹ thuật khi nó thực sự PHÙ HỢP với các món đồ thực tế:
- Đừng bao giờ gợi ý sơ vin áo croptop hoặc áo dáng rộng (oversized).
- Đừng bao giờ gợi ý xắn tay áo ngắn.
- Chỉ nhắc đến việc layer/lớp áo khi thực sự có áo khoác hoặc nhiều lớp.
- Chỉ nhắc đến thắt lưng nếu trong bộ thực sự có phụ kiện thắt lưng.
Hãy để các mẹo phù hợp thời tiết khi có thông tin thời tiết (ví dụ xắn tay áo khi trời nóng). Viết mỗi mẹo bằng tiếng Việt tự nhiên, dạng mệnh lệnh, không đánh số và không lời dẫn bên trong chuỗi.`,
};

// Localised labels for the user-turn (so the whole prompt is in one language).
const LABELS: Record<Locale, { styles: string; occasion: string; weather: string; outfit: string; write: string }> = {
  en: { styles: 'User styles', occasion: 'Occasion', weather: 'Weather', outfit: 'Outfit', write: 'Write the description and tips in English.' },
  vi: { styles: 'Phong cách người dùng', occasion: 'Dịp', weather: 'Thời tiết', outfit: 'Trang phục', write: 'Hãy viết phần mô tả và các mẹo bằng tiếng Việt.' },
};

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true }, 200);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401);

    // Validate the JWT (cheap getUser) so this isn't an open Gemini proxy.
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    // ── Rate limit ────────────────────────────────────────────────────────────
    {
      const { data: ok, error: rlErr } = await supabase.rpc('consume_rate_limit', {
        p_bucket: 'describe_outfit',
        p_max: 60,
        p_window_secs: 60,
      });
      if (rlErr) {
        console.warn('[describe-outfit] rate limit RPC error (fail open):', rlErr.message);
      } else if (ok === false) {
        return json({ error: 'rate_limited' }, 429);
      }
    }

    const apiKey = Deno.env.get('GOOGLE_API_KEY');
    if (!apiKey) return json({ description: '', wayToWear: [] }, 200);  // no key → graceful empty

    const body = await req.json().catch(() => ({})) as {
      items?: OutfitItem[]; styles?: string[]; locale?: string; occasion?: string; weather?: string;
    };
    const items = Array.isArray(body.items) ? body.items.filter(i => i && (i.name || i.type)) : [];
    if (items.length === 0) return json({ description: '', wayToWear: [] }, 200);

    const locale = resolveLocale(body.locale);
    const L = LABELS[locale];
    const itemLines = items.map((i, n) => {
      const attrs = [i.color, i.material, i.fit ? `${i.fit} fit` : null].filter(Boolean).join(', ');
      return `${n + 1}. ${i.name ?? i.type}${i.type && i.name ? ` (${i.type.toLowerCase()})` : ''}${attrs ? ` — ${attrs}` : ''}`;
    }).join('\n');
    const stylesLine = body.styles?.length ? `${L.styles}: ${body.styles.join(', ')}.` : '';
    const occasionLine = body.occasion ? `${L.occasion}: ${body.occasion}.` : '';
    const weatherLine = body.weather ? `${L.weather}: ${body.weather}.` : '';

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const model = Deno.env.get('DESCRIBE_MODEL') ?? DEFAULT_MODEL;
      const res = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
        signal: ctrl.signal,
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT[locale] }] },
          contents: [{ parts: [{ text: `${stylesLine} ${occasionLine} ${weatherLine}\n\n${L.outfit}:\n${itemLines}\n\n${L.write}` }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: DESCRIBE_SCHEMA,
            temperature: 0.6,
            maxOutputTokens: 768,
            // gemini-2.5-flash-lite (current default) thought by default in some
            // configs; disabling kept a single description well under the timeout.
            // If GEMINI_FLASH_LITE_MODEL is ever pointed at a Gemini 3 model
            // (gemini-3.1-flash-lite / gemini-3.5-flash-lite), note that family
            // replaced thinkingBudget with a thinkingLevel enum — thinkingBudget:0
            // is documented as still honored for backward compatibility, so no
            // code change is required for that swap either, but confirm latency
            // after switching (not live-verified here; no usable API key in this
            // environment).
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      });
      if (!res.ok) {
        console.warn('[describe-outfit] gemini', res.status, (await res.text()).slice(0, 200));
        return json({ description: '', wayToWear: [] }, 200);
      }
      const data: GeminiResponse = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.find(p => p.text)?.text ?? '';
      const parsed = JSON.parse(text) as { description?: unknown; wayToWear?: unknown };
      const description = typeof parsed.description === 'string' ? parsed.description.trim().slice(0, 600) : '';
      const wayToWear = Array.isArray(parsed.wayToWear)
        ? parsed.wayToWear
            .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
            .map(s => s.trim().slice(0, 120))
            .slice(0, 6)
        : [];
      return json({ description, wayToWear }, 200);
    } catch (e) {
      console.warn('[describe-outfit] failed:', (e as Error).message);
      return json({ description: '', wayToWear: [] }, 200);
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    console.error('[describe-outfit] Error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});

function json(d: unknown, s: number): Response {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
