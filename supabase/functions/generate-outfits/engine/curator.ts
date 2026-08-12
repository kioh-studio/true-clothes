// LLM curation layer — the final taste pass.
//
// The rule engine generates, validates, and ranks outfit candidates; the
// curator only SELECTS, ORDERS, and EXPLAINS among those pre-validated
// candidates (referenced by index — it can never invent items or combos).
// Any failure — missing API key, timeout, malformed output — returns null
// and the caller falls back to the rule-engine order. The feed never breaks
// because of this layer.
//
// Model is config, not architecture: override with the CURATOR_MODEL secret
// (call-site specific) which takes priority over GEMINI_FLASH_MODEL (the
// shared vision/text-tier secret also used by generate-item-image,
// backfill-item-metadata, map-measurements, tryon-validate). Default stays
// gemini-2.5-flash (retires 2026-10-16 — priced upgrade path + rationale in
// generate-item-image/index.ts's VISION_MODEL comment).
//
// Runs on Gemini (same GOOGLE_API_KEY the item-extraction functions use) via the
// REST generateContent endpoint with structured JSON output — no SDK dependency.

import { ScoredOutfit, OutfitSlots, ClothingItemRow } from './types.ts';

// Sole-torso-layer marker (2026-08-14) — the curator describes garments by
// TYPE only (see docs/redesign-outfit-completion.md's role-vocabulary gap:
// "the vocabulary names the garment, never the function the garment is
// currently performing"). Left unmarked, that produced a real defect: the
// curator saw a cardigan, knows cardigans are worn open, and wrote "open the
// cardigan" about an outfit where the cardigan was the ONLY thing on the
// torso (`top`, with no `outwear` and no `mid`) — physically impossible
// advice, since there is nothing underneath it to reveal. This flags exactly
// that condition so the candidate line itself carries the fact, independent
// of whichever garment happens to occupy the slot.
export function isSoleTorsoLayer(slots: OutfitSlots): boolean {
  return slots.outwear === undefined && slots.mid === undefined;
}

// Candidate-line item formatter (2026-08-14), extracted out of
// generate-outfits/index.ts's request handler so it's a pure, testable
// function — same motivation as isSoleTorsoLayer above.
//
// Before this, the curator's TEXT description of each garment was
// `name (type, color[, material][, fit fit])` — the DB holds pattern,
// print_scale, drape, distressed, warmth_season, and visual_interest,
// none of which reached the model. That's why SYSTEM_PROMPT could ask it to
// penalise "two statement pieces competing" or judge silhouette while having
// no data to detect either.
//
// Suppression rule: every added attribute is printed ONLY when it carries
// information (a non-default, non-null value). An OMITTED attribute means
// "unremarkable or unknown" (solid pattern, opaque, regular drape, not
// distressed, unassessed) — never "no". This is deliberate: the parenthetical
// stays short across up to 24 candidate lines instead of drowning the one
// signal that matters in a wall of nulls/defaults, and a little ambiguity is
// an acceptable price for a taste judgment (unlike the deterministic
// fit/season/formality checks the rule engine already ran before the curator
// ever sees these candidates — see SYSTEM_PROMPT below).
//
// Explicitly NOT included: `size`, any `m_*` measurement, `brand`. Fit/
// season/formality validity is already decided deterministically upstream —
// sending raw measurements invites the model to re-litigate a check code
// already does better, and `brand` invites label bias in a taste judgment
// that should be about the garment, not who made it.
export function describeItem(row: ClothingItemRow, slot: string, extra?: string): string {
  const bits: string[] = [row.type.toLowerCase(), row.color];
  if (row.material) bits.push(row.material);
  if (row.fit) bits.push(`${row.fit} fit`);

  // pattern: omit solid/none/null. print_scale rides along ONLY with a real
  // printed pattern (it's meaningless on a solid garment).
  if (row.pattern && row.pattern !== 'solid') {
    bits.push(row.printScale ? `${row.printScale} ${row.pattern}` : row.pattern);
  }
  // drape: only the two ends of the scale are informative for taste judgment
  // (does it hold its own shape, or skim the body); 'regular'/null is the
  // unremarkable middle and is omitted.
  if (row.drape === 'structured' || row.drape === 'fluid') bits.push(row.drape);
  if (row.distressed === true) bits.push('distressed');
  if (row.warmthSeason) bits.push(row.warmthSeason);
  // visual_interest → the word "statement", matching SYSTEM_PROMPT's existing
  // "statement piece" vocabulary, so the model can actually apply its own
  // "two statement pieces competing" rule. Threshold 0.8: per
  // generate-item-image/prompt.ts's own field definition, this scale is
  // documented and extracted as "0.2 = plain basic, 0.5 = solid everyday
  // piece, 0.8+ = the piece that makes an outfit" — 0.8 is the codebase's own
  // line into hero-piece territory, reused here rather than inventing a new
  // cutoff. The raw number is never printed (meaningless to the model without
  // that scale in front of it); only the word, and only near the top.
  if (typeof row.visualInterest === 'number' && row.visualInterest >= 0.8) bits.push('statement');

  if (extra) bits.push(extra);

  return `${slot}: ${row.name} (${bits.join(', ')})`;
}

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = Deno.env.get('GEMINI_FLASH_MODEL') || 'gemini-2.5-flash';
const TIMEOUT_MS = 8000;            // text-only curation of 24 candidates ≈ 4s
const TIMEOUT_MULTIMODAL_MS = 20000; // image parts push the round-trip well past 8s
const PICK_COUNT = 10;

// One wardrobe-item photo attached to the curation call (multimodal, 2026-07-03).
export interface CuratorImage {
  label: string;    // binds the photo to its item name in the candidate lines
  mimeType: string; // image/*
  dataB64: string;  // inline base64 payload
}

export interface CuratorInput {
  outfits: ScoredOutfit[];                      // rule-ranked, up to ~24
  describe: (o: ScoredOutfit) => string;        // one-line text descriptor
  profileBlock: string;                         // user styles / colors / context
  locale: string;                               // 'vi' | 'en' — note language
  // Optional item photos (multimodal): when present, the judge sees the ACTUAL
  // garments instead of label text only. Absent → text-only, as before.
  images?: CuratorImage[];
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

const SYSTEM_PROMPT = `You are MIEN's house stylist making the final call on today's outfit feed. MIEN's aesthetic is luxury minimalism in the Celine / The Row register: restraint over flash, tonal dressing, natural fabrics, precise fit — loudness must earn its place. Let that voice color your ranking and your notes, but never override the user's own stated styles: when the user leans streetwear or maximalist, their taste wins and you judge the best version of THEIR look.

You receive a numbered list of outfit candidates that have ALREADY passed validity checks (color rules, fit, season, formality). Your job is pure taste judgment.

Candidate lines may carry extra parenthetical tags when they're informative: a pattern (with its scale), drape (structured/fluid), distressed, a warmth/season tag, and "statement" for a strong visual-interest piece. An ABSENT tag means unremarkable or simply unassessed — never read it as "no" or hold it against the item.

Rank the ${PICK_COUNT} best candidates, best first. Judge like a stylist, not a checklist:
- Reward outfits that read as intentional: a clear hero piece, deliberate light/dark contrast between top and bottom, classic combinations (oxford shirt + tailored trousers + loafers; tee + jeans + clean sneakers).
- Penalize outfits that are merely valid: flat all-dark or all-mid-tone looks, two statement pieces competing, safe-but-boring repetition of near-identical combos. If two picks differ by one item, separate them in the ranking.
- Penalize a fluid/voluminous top over a fluid/voluminous bottom: both pieces skimming rather than fitting erases the waist — a silhouette fault, not a color or fit one, so look at the drape tags together.
- Respect the user's profile block: their personal color season and undertone, body shape, the occasion and weather if given.

Veto a candidate only when it is genuinely off (clashing dressiness, dated pairing, visually flat) — vetoing is a strong signal, use it sparingly (0–4 vetoes).

For each pick write ONE short stylist note (max ~120 characters) in the language requested by the user message. The note must explain WHY this works for THIS user — name a concrete item, color relationship, or context. Never generic praise, never repeat the same sentence pattern twice. A candidate line marked "sole torso layer" has NOTHING else on the torso — never tell the user to wear that garment open, unbuttoned, or layered over something; it is being worn closed, full stop.

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

  // Multimodal: item photos precede the candidate list, each bound to its item
  // name so the model can match photos to the labels used in the lines below.
  const images = input.images ?? [];
  const imageParts = images.flatMap(img => [
    { text: `PHOTO of item: ${img.label}` },
    { inlineData: { mimeType: img.mimeType, data: img.dataB64 } },
  ]);
  const visualHint = images.length > 0
    ? `\n\nItem photos are attached above the candidates. Judge colour relationships, texture, drape and how the ACTUAL garments would sit together from the photos — the text labels are only an index.`
    : '';

  // Single attempt, hard timeout — any failure falls back to the rule order so
  // the feed never stalls on this layer.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), images.length > 0 ? TIMEOUT_MULTIMODAL_MS : TIMEOUT_MS);
  try {
    const res = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
      signal: ctrl.signal,
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{
          parts: [
            ...imageParts,
            {
              text: `${input.profileBlock}${visualHint}\n\nCandidates:\n${lines}\n\nPick and rank the ${PICK_COUNT} best. Write each note in ${noteLang}.`,
            },
          ],
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: CURATION_SCHEMA,
          temperature: 0.4,
          maxOutputTokens: 2048,
          // gemini-2.5-flash (today's default) enables "thinking" by default, which
          // pushed this call to ~10s (≈1.4k thought tokens) — well past TIMEOUT_MS, so
          // EVERY curation aborted and fell back to rule order. thinkingBudget:0
          // disabled it, dropping to ~1.2s. Gemini 3 models (e.g. gemini-3.6-flash, the
          // priced upgrade candidate for when GEMINI_FLASH_MODEL migrates off
          // gemini-2.5-flash — see generate-item-image/index.ts's VISION_MODEL comment)
          // replaced thinkingBudget with a thinkingLevel enum
          // ('minimal'|'low'|'medium'|'high', default 'high' for Flash-tier);
          // thinkingBudget:0 is documented as still honored for backward compatibility,
          // so this is left as-is, but it has not been live-verified against a Gemini 3
          // default (no usable API key in this environment) — confirm curation latency
          // stays under TIMEOUT_MS after migrating, and switch to thinkingConfig: {
          // thinkingLevel: 'minimal' } if not.
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
