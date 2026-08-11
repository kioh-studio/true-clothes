// AI fit-note for the Verdict — the short note shown UNDER the measurement bars
// (feature: "is this item worth buying for me, and why / why not").
//
// GROUNDED, not free-form: the model only paraphrases the already-computed,
// deterministic scores + per-measurement ease. It must not invent numbers. When
// fit can't be measured (no body or no garment measurements) it says so plainly
// instead of guessing — which is the honest buy-or-not signal. Localised EN/VI.
//
// Best-effort: every failure path returns '' so the Verdict still renders without
// a note (the caller maps '' → fit_note:null). Mirrors describe-outfit's Gemini call.

import { FitItem, BodyMeasurements } from '../generate-outfits/engine/types.ts';
import { VerdictResult } from './scoring.ts';
import { scoreItemFit } from '../generate-outfits/engine/scoring.ts';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
// Override precedence: VERDICT_NOTE_MODEL (call-site) > GEMINI_FLASH_LITE_MODEL
// (shared cheap-lite-tier secret, also used by describe-outfit).
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
const TIMEOUT_MS = 8000;
const MAX_NOTE_CHARS = 600;

export type Locale = 'en' | 'vi';
export function resolveLocale(l?: string): Locale {
  return l === 'vi' ? 'vi' : 'en'; // default English (verdict caller passes explicit locale)
}

export interface NoteProfile {
  gender?: string;
  colorSeason?: string;
  styles: string[];
}

// ── Build the compact, deterministic context the model is allowed to use ───────
// Only the fields that legitimately shape the note appear here — the model is told
// to use NOTHING else. Returns the JSON string sent as the user turn.
export function buildNoteContext(
  verdict: VerdictResult,
  fitItem: FitItem,
  body: BodyMeasurements,
  item: { type: string; color: string; material?: string; fit?: string; pattern?: string },
  profile: NoteProfile,
  locale: Locale,
): string {
  const fit = scoreItemFit(fitItem, body);

  const criteria = verdict.criteria.map((c) => ({
    key: c.key,
    available: c.available,
    score: c.score,
    why: c.explanation,
  }));

  // Per-measurement ease: + = roomier than your body, - = tighter. category is the
  // engine's wearability bucket (tight/snug/standard/roomy/oversized).
  const measurements = fit.measured
    ? fit.points.map((p) => ({ key: p.key, ease_cm: Math.round(p.ease * 10) / 10, fit: p.category }))
    : [];

  const payload = {
    locale,
    overall: verdict.overall_score,
    recommendation: verdict.recommendation,
    item,
    profile: {
      gender: profile.gender ?? null,
      colorSeason: profile.colorSeason ?? null,
      styles: profile.styles,
    },
    criteria,
    fit_measured: fit.measured,
    measurements,
    warnings: fit.warnings,
  };
  return JSON.stringify(payload);
}

// ── Localised system prompts (sent in the target language so copy reads native) ─
const SYSTEM_PROMPT: Record<Locale, string> = {
  en: `You are a personal fit advisor. You are given a JSON object with a deterministic verdict for ONE prospective clothing item scored against ONE user's profile: an overall score, per-criterion scores (color, style, fit, measurement, fabric) each with a short reason, and — when available — per-measurement "ease_cm" (positive = the garment is roomier than the user's body at that point, negative = tighter) with a fit category, plus any tightness warnings.

Write a SHORT decision note (max ~480 characters) that helps the user decide whether to buy. Structure it as:
- one plain-language verdict sentence, then
- "Fits:" — 1-3 concrete pluses (only criteria that scored well or measurements with comfortable ease), then
- "Watch out:" — 1-3 concrete minuses (low criteria, tight measurements, missing data).

Rules: Use ONLY the data in the JSON. NEVER invent measurements or numbers not present. If fit_measured is false, say fit could not be assessed and that adding body measurements (and the garment's size chart) would make this accurate — do not guess the fit. If a criterion is unavailable, you may note what's missing. Be specific and honest; this is a buy/skip aid, not marketing. Write natural English. Output ONLY the note text — no JSON, no preamble, no quotes.`,
  vi: `Bạn là cố vấn độ vừa vặn (fit) cá nhân. Bạn nhận một đối tượng JSON chứa kết quả chấm điểm xác định cho MỘT món đồ mà người dùng đang cân nhắc mua, đối chiếu với hồ sơ của MỘT người dùng: điểm tổng, điểm từng tiêu chí (color, style, fit, measurement, fabric) kèm lý do ngắn, và — khi có — "ease_cm" theo từng số đo (dương = món đồ rộng hơn cơ thể ở điểm đó, âm = chật hơn) kèm nhóm độ vừa, cùng các cảnh báo chật.

Hãy viết một ghi chú quyết định NGẮN (tối đa khoảng 480 ký tự) giúp người dùng quyết định có nên mua. Cấu trúc:
- một câu kết luận bằng lời dễ hiểu, rồi
- "Hợp:" — 1-3 điểm cộng cụ thể (chỉ các tiêu chí điểm tốt hoặc số đo có khoảng dư thoải mái), rồi
- "Lưu ý:" — 1-3 điểm trừ cụ thể (tiêu chí điểm thấp, số đo chật, hoặc dữ liệu còn thiếu).

Quy tắc: CHỈ dùng dữ liệu trong JSON. TUYỆT ĐỐI không bịa số đo hay con số không có sẵn. Nếu fit_measured là false, hãy nói rằng chưa đánh giá được độ vừa và rằng việc thêm số đo cơ thể (cùng bảng size của món đồ) sẽ giúp chính xác — đừng đoán fit. Nếu một tiêu chí không khả dụng, có thể nêu nó đang thiếu gì. Hãy cụ thể và trung thực; đây là công cụ hỗ trợ mua/bỏ qua, không phải quảng cáo. Viết tiếng Việt tự nhiên. CHỈ xuất ra nội dung ghi chú — không JSON, không lời dẫn, không dấu ngoặc kép.`,
};

const WRITE_INSTRUCTION: Record<Locale, string> = {
  en: 'Write the buy-decision note in English.',
  vi: 'Hãy viết ghi chú quyết định mua bằng tiếng Việt.',
};

// ── Gemini call (best-effort; '' on any failure) ───────────────────────────────
export async function generateFitNote(
  apiKey: string,
  context: string,
  locale: Locale,
): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const model = Deno.env.get('VERDICT_NOTE_MODEL') ?? DEFAULT_MODEL;
    const res = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
      signal: ctrl.signal,
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT[locale] }] },
        contents: [{ parts: [{ text: `DATA:\n${context}\n\n${WRITE_INSTRUCTION[locale]}` }] }],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 512,
          // Single short note — no thinking, keeps latency low. If
          // GEMINI_FLASH_LITE_MODEL is ever pointed at a Gemini 3 model,
          // thinkingBudget:0 is documented as still honored for backward
          // compat, but not live-verified here (no usable API key).
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
    if (!res.ok) {
      console.warn('[evaluate-item/note] gemini', res.status, (await res.text()).slice(0, 200));
      return '';
    }
    const data = await res.json();
    const text: string =
      data.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text ?? '';
    return text.trim().slice(0, MAX_NOTE_CHARS);
  } catch (e) {
    console.warn('[evaluate-item/note] failed:', (e as Error).message);
    return '';
  } finally {
    clearTimeout(timer);
  }
}
