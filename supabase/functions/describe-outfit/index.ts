// Edge Function: describe-outfit  (feature 008 — lazy outfit description)
// POST /functions/v1/describe-outfit
// Auth: Bearer token (Supabase JWT) — same pattern as evaluate-item.
//
// Generates ONE 2–3 sentence editorial description for a SINGLE outfit, on demand
// when the user opens the detail screen. Kept out of the feed's bulk curation pass
// (which only ranks + writes the one-line note) because generating 10 descriptions
// at once takes ~10s and would block the feed; one description is ~1–2s.
//
// Body: { items: [{ name, type, color, material?, fit? }], styles?: string[],
//         locale?: 'vi'|'en', occasion?: string }
// Response: { description: string }   (empty string on any AI failure — caller
//            falls back to its own item-list text; this never 500s on AI issues.)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
// flash-lite: for a single short description it reads more editorial (less list-y)
// than 2.5-flash, at the same latency and ~3–4× cheaper. Override via DESCRIBE_MODEL.
const DEFAULT_MODEL = 'gemini-2.5-flash-lite';
const TIMEOUT_MS = 8000;   // one description ≈ 1–2s; generous headroom, detail screen shows a loader

interface OutfitItem {
  name?: string; type?: string; color?: string; material?: string; fit?: string;
}

type Locale = 'en' | 'vi';
function resolveLocale(l?: string): Locale {
  return l === 'en' ? 'en' : 'vi'; // default Vietnamese (matches the app's primary locale)
}

// Two fully-localised system prompts. We send the prompt in the SAME language we
// want back (not an English prompt with a "write in X" rider) so the copy reads
// natively. `en` param → English description, `vi` param → Vietnamese description.
const SYSTEM_PROMPT: Record<Locale, string> = {
  en: `You are a fashion stylist writing the description shown on an outfit's detail screen. Given the garments in ONE outfit and the user's styles, write 2–3 sentences (max ~320 characters) of editorial copy: the overall vibe, how the pieces work together (colour/texture/proportion), and the occasion or styling to wear it for. Be specific to the actual garments — do not just list them, and do not invent items that are not present. Write in natural, idiomatic English. Output ONLY the description text, no preamble, no quotes.`,
  vi: `Bạn là một stylist thời trang, viết phần mô tả hiển thị ở màn hình chi tiết của một bộ trang phục. Dựa trên các món đồ trong MỘT bộ trang phục và phong cách của người dùng, hãy viết 2–3 câu (tối đa khoảng 320 ký tự) mang tính biên tập: thần thái tổng thể, cách các món đồ kết hợp với nhau (màu sắc/chất liệu/tỷ lệ), và dịp hoặc cách phối để mặc. Hãy bám sát đúng các món đồ thực tế — đừng chỉ liệt kê, và đừng bịa thêm món không có trong bộ. Viết bằng tiếng Việt tự nhiên, mượt mà. CHỈ xuất ra phần mô tả, không lời dẫn, không dấu ngoặc kép.`,
};

// Localised labels for the user-turn (so the whole prompt is in one language).
const LABELS: Record<Locale, { styles: string; occasion: string; outfit: string; write: string }> = {
  en: { styles: 'User styles', occasion: 'Occasion', outfit: 'Outfit', write: 'Write the description in English.' },
  vi: { styles: 'Phong cách người dùng', occasion: 'Dịp', outfit: 'Trang phục', write: 'Hãy viết phần mô tả bằng tiếng Việt.' },
};

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

    const apiKey = Deno.env.get('GOOGLE_API_KEY');
    if (!apiKey) return json({ description: '' }, 200);  // no key → graceful empty

    const body = await req.json().catch(() => ({})) as {
      items?: OutfitItem[]; styles?: string[]; locale?: string; occasion?: string;
    };
    const items = Array.isArray(body.items) ? body.items.filter(i => i && (i.name || i.type)) : [];
    if (items.length === 0) return json({ description: '' }, 200);

    const locale = resolveLocale(body.locale);
    const L = LABELS[locale];
    const itemLines = items.map((i, n) => {
      const attrs = [i.color, i.material, i.fit ? `${i.fit} fit` : null].filter(Boolean).join(', ');
      return `${n + 1}. ${i.name ?? i.type}${i.type && i.name ? ` (${i.type.toLowerCase()})` : ''}${attrs ? ` — ${attrs}` : ''}`;
    }).join('\n');
    const stylesLine = body.styles?.length ? `${L.styles}: ${body.styles.join(', ')}.` : '';
    const occasionLine = body.occasion ? `${L.occasion}: ${body.occasion}.` : '';

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
          contents: [{ parts: [{ text: `${stylesLine} ${occasionLine}\n\n${L.outfit}:\n${itemLines}\n\n${L.write}` }] }],
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 512,
            // gemini-2.5-flash thinks by default (~10s); a single description does not
            // need it and thinking would blow the timeout. Disable it.
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      });
      if (!res.ok) {
        console.warn('[describe-outfit] gemini', res.status, (await res.text()).slice(0, 200));
        return json({ description: '' }, 200);
      }
      const data = await res.json();
      const text: string = data.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text ?? '';
      return json({ description: text.trim().slice(0, 600) }, 200);
    } catch (e) {
      console.warn('[describe-outfit] failed:', (e as Error).message);
      return json({ description: '' }, 200);
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
