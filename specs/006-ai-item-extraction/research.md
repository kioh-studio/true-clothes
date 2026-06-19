# Phase 0 Research: AI Item Extraction

Decisions resolving the Technical Context. Each: **Decision / Rationale / Alternatives**.

---

## R1 — One Gemini function for both detect + image-gen

**Decision**: A single Edge Function (`generate-item-image`) runs both steps with Gemini: step 1 vision detects garments and returns controlled-vocab JSON; step 2 generates one isolated image per garment (in parallel).

**Rationale**: Confirmed with product. One model, one function, one API key (`GOOGLE_API_KEY`), one round-trip from the client. Matches `reference.md` ("gọi gemini AI để detect"). The existing `generate-item-image` already implements this shape; we upgrade its schema.

**Alternatives**: Claude (`extract-garments`) for metadata + nano banana for images — better vocab adherence but two models/keys, higher cost/latency. Rejected; the Claude prompt's rigor is ported into the Gemini detection prompt (R4). The Claude path is removed as dead duplicate.

---

## R2 — Image model: "nano banana 2" (Gemini 3 Pro Image)

**Decision**: Use **nano banana 2 / Gemini 3 Pro Image** for per-item isolation, targeting ~1K. The exact model id and resolution param are verified against current Google Generative Language API docs at implementation time; if 1K is not directly controllable, downscale on device to ~1K long edge via `expo-image-manipulator` (`itemPhotoService.optimizeImage`).

**Rationale**: Product chose the higher-fidelity tier so isolated garments keep accurate colour/texture/detail in outfit cards (SC-006, FR-009). Reference names "nano banana 2".

**Alternatives**: Nano Banana (Gemini 2.5 Flash Image) — cheaper/faster; documented fallback (single model-id constant) if Pro is unavailable/too costly.

---

## R3 — Controlled vocabulary is the output contract

**Decision**: Detection MUST emit values matching `supabase/functions/generate-outfits/engine/enrichment.ts` exactly: `type` (40 UPPERCASE), `color` (37 Title Case), `material` (Title Case), `fit` (5 groups via aliases), `pattern` (alias set), `warmth_season` (4). The function constrains the model via an explicit enum list **and post-validates** each field server-side, snapping near-misses to the nearest valid value (case-normalise, alias-map; default only as last resort).

**Rationale**: The engine normalises through hard maps and **silently falls back to defaults** on mismatch. Silent signal loss is the #1 correctness risk (FR-006, FR-020, SC-003). Constrain in-prompt *and* validate in-code.

**Alternatives**: Trust free-text output (status quo) — rejected, it causes today's silent fallbacks. Map on the client — rejected; enforce at the model boundary.

---

## R4 — Injection-safe note enrichment

**Decision**: Accept optional per-photo `notes` to enrich extraction, appended to the user turn **fenced as untrusted context** with explicit "do not override instructions/format" guarding — porting the wording from the old `extract-garments/prompt.ts`. Notes may guide identification but cannot change schema/vocab/format.

**Rationale**: FR-017 / SC-007. Reference flags prompt injection; the Claude prompt already solved it — reuse for Gemini.

**Alternatives**: Drop notes (loses context) / inject unfenced (injection risk) — both rejected.

---

## R5 — Logo / graphic signals: store in `graphics jsonb`, do not score yet

**Decision** (product-confirmed): Detection extracts per-garment logo signals — `present` (bool), `size` (small|medium|large), `kind` (brand_logo|slogan_text|graphic), `text` (OCR, nullable). Persist as a nullable **`graphics jsonb`** column on `clothing_items`. The fit engine does not read it in MVP.

**Rationale**: FR-016 / reference Note. The engine comment in `enrichment.ts` anticipates a future `graphics` column; a JSONB blob captures the cluster now without committing to a scored shape, and is forward-compatible. Product chose jsonb over flat columns (no logo UI exists; data is dormant).

**Alternatives**: Flat columns (matches the table's flat style, typed/queryable) — viable but 4 columns for unused data; not chosen. Defer entirely — rejected; reference says "lưu" (store).

---

## R6 — Measurements: type-aware AI **estimates**, pre-filled and editable, written to flat `m_*`

**Decision** (product call, revised): Detection emits **type-aware measurement estimates** per garment (top / bottom / footwear / bag groups), pre-filled into each review card and **user-editable**. Estimates derive from the garment as seen plus typical values for its type — never from body measurements. Only keys mapping to a real engine column persist (`m_chest, m_shoulder_width, m_sleeves, m_body_length, m_waist, m_hip, m_inseam, m_thigh, m_rise, m_skirt_length, m_shoe_size`); UI-only fields without a column (bag width/height/depth, shoe insole) are shown but not persisted in MVP.

**Rationale**: Matches the approved design (`OI_MEASURE_SCHEMA` / `OI_MEASURE_DEFAULTS`) and the product decision that a filled, editable estimate beats empty fields. The user correcting/clearing wrong values is the safeguard. **Trade-off accepted (owner-approved)**: estimated measurements DO feed the fit engine (items no longer scored at neutral 0.5), overriding the earlier reference stance.

**Alternatives**: Empty-unless-legible (original reference rule) — rejected by product for UX. Hardcoded generic defaults only — weaker than per-garment estimates; the prototype constants are placeholders, real estimates come from the model.

---

## R7 — UI: the full Add to Wardrobe wizard (per approved design)

**Decision**: Implement the RN version of the approved 4-step wizard (`outfit-import.jsx`): **Upload** (multi-photo gallery; per-photo method + notes; add/remove) → **Analyse** (per-photo scan + progress) → **Review** (item cards grouped by source photo; each card edits name/category/colour/fabric/brand/link + type-aware measurements + tags, with remove) → **Done** (saved count). The method chooser is a two-phase sheet (method → source → library multi-select). The prototype's inline styles are translated to `src/design/tokens.ts`.

**Rationale**: Direct product instruction ("bám sát màn hình hiện tại" — the wizard anh Khôi added). Satisfies spec US1/US2 and FR-022/023/024. Replaces the single-item AI form (which kept only the first detected item).

**Alternatives**: Enhance the single-item `add-item.tsx` form (earlier draft) — rejected; does not match the approved design and loses the multi-photo/grouped-review UX.

---

## R8 — Cost control: per-AI-photo credit gating + premium unlimited

**Decision**: Each **AI** photo consumes one `ai_extraction` credit via `usageCreditService` (`checkCredit`/`incrementCredit`), checked **before** invoking the function. Premium (live `usePremium` OR stored `account_type` via `hasPremiumAccountType()`) is unlimited. A failed extraction consumes no credit and offers one retry. The on-device "item" method is free (no credit).

**Rationale**: Reference flags AI cost; nano banana 2 is the pricier tier (R2). Pattern already existed in the dead `useItemExtraction` and 005's plan ("2 scans/month free").

**Alternatives**: No gating (uncontrolled cost) / new billing model (out of scope) — rejected.

---

## R9 — Remove the dead Claude duplicate; fold the old hook

**Decision**: Delete `supabase/functions/extract-garments/` and `src/services/aiExtractionService.ts`. Fold `src/features/ai-extraction/useItemExtraction.ts` into the new `useAddWizard` (or delete after migrating its credit/state logic).

**Rationale**: Two parallel implementations is a maintenance trap. `extract-garments` is undeployed; `aiExtractionService` is referenced only by the dead hook; the hook calls `sb` directly (Principle III violation). Consolidate on the Gemini path + the wizard.

**Alternatives**: Leave both (drift/dead code) — rejected.

---

## R10 — Deployment & secrets

**Decision**: After upgrading, **deploy** `generate-item-image` (only `generate-outfits` is deployed today). Ensure `GOOGLE_API_KEY` is set. Apply the `graphics` migration before client writes. Order: migration → function deploy → client.

**Rationale**: The AI flow cannot work in production today (function local-only). Ordering avoids writes to a missing column/function.

**Alternatives**: None — deployment is required.

---

## R11 — On-device "Extract by item" is a separate feature (the wizard provides the seam)

**Decision**: The wizard's **"Extract by item"** method (on-device ML segmentation of a single item on a plain/solid background, plus best-effort attribute enrichment) is specified and delivered separately in **`specs/extract-by-item/`**. Feature 006 builds the shared wizard shell + a thin `extractByItemService` interface (with a stub) that the item method dispatches to; the separate feature implements it. Both methods converge on the same Review/save path.

**Rationale**: Product instruction to "tạo thêm specs extract-by-item luôn" and that the item method uses on-device ML (iOS Vision / Android ML Kit) for solid-background cutout — a distinct technical area (no server/Gemini) deserving its own spec/plan/tasks. Keeping it behind a service interface honors Principle VI (no feature-to-feature import) and lets the two features land independently.

**Alternatives**: Build the on-device method inside 006 — rejected; different tech stack (on-device ML), larger scope, and product asked for a dedicated spec. Defer the method entirely from the wizard — rejected; the chooser shows both, so the seam must exist now.
