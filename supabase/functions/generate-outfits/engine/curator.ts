// LLM curation layer — the final taste pass.
//
// The rule engine generates, validates, and ranks outfit candidates; the
// curator only SELECTS, ORDERS, and EXPLAINS among those pre-validated
// candidates (referenced by index — it can never invent items or combos).
// Any failure — missing API key, timeout, malformed output — returns null
// and the caller falls back to the rule-engine order. The feed never breaks
// because of this layer.
//
// Model is config, not architecture: override with the CURATOR_MODEL secret.
//
// Runs on Gemini (same GOOGLE_API_KEY the item-extraction functions use) via the
// REST generateContent endpoint with structured JSON output — no SDK dependency.

import { ScoredOutfit } from './types.ts';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.5-flash';
const TIMEOUT_MS = 8000;  // note-only curation of 24 candidates ≈ 4s; headroom so it never intermittently aborts
const PICK_COUNT = 10;

export interface CuratorInput {
  outfits: ScoredOutfit[];                      // rule-ranked, up to ~24
  describe: (o: ScoredOutfit) => string;        // one-line text descriptor
  profileBlock: string;                         // user styles / colors / context
  locale: string;                               // 'vi' | 'en' — note language
}

export interface CuratorResult {
  outfits: ScoredOutfit[];                      // re-ranked, with stylistNote
  vetoCount: number;
}

// Gemini responseSchema (OpenAPI subset): uppercase types, no additionalProperties,
// propertyOrdering to keep the model's field order stable.
const CURATION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    picks: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          index: { type: 'INTEGER' },
          note: { type: 'STRING' },
        },
        required: ['index', 'note'],
        propertyOrdering: ['index', 'note'],
      },
    },
    vetoes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          index: { type: 'INTEGER' },
          reason: { type: 'STRING' },
        },
        required: ['index', 'reason'],
        propertyOrdering: ['index', 'reason'],
      },
    },
  },
  required: ['picks', 'vetoes'],
  propertyOrdering: ['picks', 'vetoes'],
} as const;

const SYSTEM_PROMPT = `You are a personal fashion stylist making the final call on today's outfit feed. You receive a numbered list of outfit candidates that have ALREADY passed validity checks (color rules, fit, season, formality). Your job is pure taste judgment.

Rank the ${PICK_COUNT} best candidates, best first. Judge like a stylist, not a checklist:
- Reward outfits that read as intentional: a clear hero piece, deliberate light/dark contrast between top and bottom, classic combinations (oxford shirt + tailored trousers + loafers; tee + jeans + clean sneakers).
- Penalize outfits that are merely valid: flat all-dark or all-mid-tone looks, two statement pieces competing, safe-but-boring repetition of near-identical combos. If two picks differ by one item, separate them in the ranking.
- Respect the user's profile block: their personal color season and undertone, body shape, the occasion and weather if given.

Veto a candidate only when it is genuinely off (clashing dressiness, dated pairing, visually flat) — vetoing is a strong signal, use it sparingly (0–4 vetoes).

For each pick write ONE short stylist note (max ~120 characters) in the language requested by the user message. The note must explain WHY this works for THIS user — name a concrete item, color relationship, or context. Never generic praise, never repeat the same sentence pattern twice.

Reference candidates strictly by their # index. Output only the structured result.`;

interface ParsedCuration {
  picks: Array<{ index: number; note: string }>;
  vetoes: Array<{ index: number; reason: string }>;
}

// Single switch for the whole LLM path. When the key is absent the caller
// must skip curation entirely — no prompt building, no network call — and return
// the rule-engine order directly.
export function curatorEnabled(): boolean {
  return Boolean(Deno.env.get('GOOGLE_API_KEY'));
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

export async function curateOutfits(input: CuratorInput): Promise<CuratorResult | null> {
  const apiKey = Deno.env.get('GOOGLE_API_KEY');
  if (!apiKey || input.outfits.length === 0) return null;

  const model = Deno.env.get('CURATOR_MODEL') ?? DEFAULT_MODEL;

  const lines = input.outfits.map((o, i) => `#${i} ${input.describe(o)}`).join('\n');
  const noteLang = input.locale === 'vi' ? 'Vietnamese' : 'English';

  // Single attempt, hard timeout — any failure falls back to the rule order so
  // the feed never stalls on this layer.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
      signal: ctrl.signal,
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{
          parts: [{
            text: `${input.profileBlock}\n\nCandidates:\n${lines}\n\nPick and rank the ${PICK_COUNT} best. Write each note in ${noteLang}.`,
          }],
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: CURATION_SCHEMA,
          temperature: 0.4,
          maxOutputTokens: 2048,
          // gemini-2.5-flash enables "thinking" by default, which pushes this call
          // to ~10s (≈1.4k thought tokens) — well past TIMEOUT_MS, so EVERY curation
          // aborted and fell back to rule order. Disabling thinking drops it to ~1.2s.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    if (!res.ok) {
      console.warn('[curator] falling back to rule order:', res.status, (await res.text()).slice(0, 200));
      return null;
    }

    const data: GeminiResponse = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.find(p => p.text)?.text;
    if (!text) return null;
    const parsed = JSON.parse(text) as ParsedCuration;
    return assemble(input.outfits, parsed);
  } catch (err) {
    console.warn('[curator] falling back to rule order:', err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Validates indices, applies vetoes, backfills from rule order to PICK_COUNT.
function assemble(outfits: ScoredOutfit[], parsed: ParsedCuration): CuratorResult | null {
  const n = outfits.length;
  const vetoed = new Set(
    (parsed.vetoes ?? []).map(v => v.index).filter(i => Number.isInteger(i) && i >= 0 && i < n),
  );

  const seen = new Set<number>();
  const picked: ScoredOutfit[] = [];
  for (const p of parsed.picks ?? []) {
    if (!Number.isInteger(p.index) || p.index < 0 || p.index >= n) continue;
    if (seen.has(p.index) || vetoed.has(p.index)) continue;
    seen.add(p.index);
    picked.push({ ...outfits[p.index], stylistNote: p.note?.slice(0, 200) });
    if (picked.length >= PICK_COUNT) break;
  }

  // Backfill with the rule order so a stingy or over-vetoing model never shrinks the feed.
  for (let i = 0; i < n && picked.length < PICK_COUNT; i++) {
    if (seen.has(i) || vetoed.has(i)) continue;
    seen.add(i);
    picked.push(outfits[i]);
  }

  if (picked.length === 0) return null;
  return { outfits: picked, vetoCount: vetoed.size };
}
