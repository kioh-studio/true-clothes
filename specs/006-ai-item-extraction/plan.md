# Implementation Plan: AI Item Extraction from Outfit Photos

**Branch**: `006-ai-item-extraction` | **Date**: 2026-06-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-ai-item-extraction/spec.md`

## Summary

Build the **Add to Wardrobe wizard** (full-screen, 4 steps: Upload → Analyse → Review → Done) per the approved design (`screens/True Clothes - Wardrobe add` → `outfit-import.jsx`), and wire its **"Extract by AI"** method to a real Gemini pipeline. The user adds one or more photos, each tagged with a method (Extract by AI / Extract by item) and optional notes; the wizard analyses each photo independently; Review shows extracted item cards **grouped by source photo** (image + name + category/colour/fabric/brand/link + type-aware measurements + tags + remove); Done confirms the saved count.

For the **AI method**, one Supabase Edge Function (Gemini for both steps) detects every garment a subject wears, extracts each garment's attributes in the engine's **controlled vocabulary** (`type`, `color`, `material`, `fit`, `pattern`, `warmth_season`), estimates **type-aware measurements** (pre-filled, user-editable), captures logo signals, and generates an isolated white-background product image (~1K) per garment with nano banana 2 — returning data and images correctly paired. Saved items persist the real `type/color/fit/m_*/graphics` the fit engine depends on.

Scope of **this feature (006)**: the shared wizard shell + the **AI method** end-to-end. The wizard's second method, **"Extract by item"** (on-device ML segmentation of a single item on a plain background), is specified and delivered separately in **`specs/extract-by-item/`**; 006 defines the seam (a method-dispatch service interface) so that feature plugs in without rework.

This replaces the single-item AI form in `app/add-item.tsx` (which kept only the first detected item and wrote the old `category/primaryColor` schema) and finishes work the earlier features only stubbed: the extraction Edge Functions exist locally but **none are deployed**.

Product decisions (confirmed): **Gemini does both detect + image-gen** in one function; image model is **nano banana 2 (Gemini 3 Pro Image)**; logo stored as **`graphics jsonb`**; **measurements pre-filled as editable AI estimates** (they do feed the engine; user correction is the safeguard); the wizard hosts **both methods**.

## Technical Context

| Key | Value |
|-----|-------|
| Language | TypeScript strict (no `any`) |
| UI | React Native 0.81 + Expo SDK (expo-router ~6) — iOS + Android |
| Navigation | Expo Router (file-based); the wizard is a full-screen route |
| State | Zustand v5 + AsyncStorage persist (`appStore`, `fitEngineStore`) |
| Edge runtime | Deno (Supabase Edge Functions) |
| AI — detection | Gemini vision (text-out) → controlled-vocab JSON + type-aware measurement estimates + logo signals |
| AI — image gen | **nano banana 2 / Gemini 3 Pro Image** (image-out), ~1K (model id verified in research R2; on-device downscale fallback) |
| Image handling | `expo-image-picker` (camera + library, **multi-select**), `expo-file-system/legacy`, existing `itemPhotoService` |
| Remote persistence | Supabase `clothing_items` (existing `type/color/material/fit/pattern/warmth_season/brand/source_url/m_*` + new `graphics jsonb`) |
| Cost control | Per-AI-photo credit gating via `usageCreditService` (`ai_extraction`); premium unlimited (`usePremium` / `hasPremiumAccountType`) |
| Secrets | `GOOGLE_API_KEY` set before deploy |
| Testing | Jest + RN Testing Library; hook + service unit tests |
| Performance | Wizard responsive; per-AI-photo extraction (detect + N parallel image-gens) target ≤ ~30 s for 3–5 items; 60 fps |
| Constraints | Controlled-vocab values MUST match `enrichment.ts` (silent fallback otherwise); measurements never from body; injection-safe notes; data↔image pairing preserved on partial failure |
| Scale/Scope | Personal wardrobes; multi-photo session; 1 AI photo → ~1–8 garments; one Edge call per AI photo |

**Unknowns**: exact "nano banana 2" model id + 1K control (research R2, with fallback). The on-device "item" method's internals are out of scope here (own spec). No blocking spec ambiguities.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Applies? | Resolution |
|---|------|----------|------------|
| I | Luxury Minimalist Design (NON-NEGOTIABLE) | **Yes** — full wizard (stepper, upload list, scan state, review cards, done) | All UI via `src/design/tokens.ts` (no inline hex), hairline icons, full-bleed item imagery, slow transitions, no shadows/gradients (except the existing subtle sheet shadow). The prototype's inline styles are **translated to tokens**, not copied. Specced in `src/design/wardrobe-add/design.md`. **PASS (design-time)** |
| II | Thin Screens / Logic Separation (NON-NEGOTIABLE) | **Yes** — replaces inline logic in `add-item.tsx` (current violation) | All wizard/extraction/save logic in `useAddWizard` hook + services; step components render state + dispatch. No `async` in JSX. **PASS** |
| III | Service Abstraction Layer (NON-NEGOTIABLE) | **Yes** — Edge + DB | Edge invoked only via `imageGenerationService`; DB only via `wardrobeService`; method dispatch via a small service interface. Hooks/components never import `sb`. **PASS** |
| IV | Type Safety & Domain Integrity (NON-NEGOTIABLE) | **Yes** — new `fit`, `measurements`, `graphics`, brand/link/tags | New types in `src/types/fitEngine.ts` + feature `types.ts`. Colors = controlled named strings; measurements = metric numbers; controlled attrs constrained + validated. No `any`. Service owns camelCase↔snake_case. **PASS** |
| V | Dual-Persistence Architecture | **Partial** | No scoring/ranking *logic* change (client engine copy already removed; only edge engine remains). Estimated measurements feed the engine as *data*, not a logic change — accepted product decision. Local-first save unchanged. **PASS** |
| VI | Feature Self-Containment | **Yes** | One feature `src/features/wardrobe-add/`; the AI and item methods both reach shared **services** (not each other). The `extract-by-item` feature plugs into the wizard's method-dispatch seam via a service, not a direct feature import. **PASS** |
| WF | Schema change → migration | **Yes** | `graphics jsonb` migration. `type/color/fit/pattern/warmth_season/brand/source_url/m_*` already exist (verified). **PASS** |
| WF | Demo account functional | **Yes** | Demo items static, `graphics` nullable. Manual add path preserved as regression. **PASS** |

**Initial gate result: PASS** — no violations requiring Complexity Tracking (the pre-existing inline-logic violation is remediated here).

## Project Structure

### Documentation (this feature)

```text
specs/006-ai-item-extraction/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/generate-item-image.md
├── checklists/requirements.md
└── tasks.md            # (/speckit-tasks)
```

### Source Code (repository root)

```text
# ── Edge Function (UPGRADE + DEPLOY) ──────────────────────────────────────────
supabase/functions/generate-item-image/
├── index.ts            # MODIFIED — controlled-vocab detection + validate/snap;
│                       #   type-aware measurement ESTIMATES; logo signals;
│                       #   nano banana 2 image-gen; injection-safe notes; pairing;
│                       #   partial-failure tolerance. THEN deploy.
└── prompt.ts           # NEW — system/user prompts + controlled-vocab constants

supabase/migrations/20260620000001_clothing_items_graphics.sql   # graphics jsonb

# ── Client services (MODIFIED) ────────────────────────────────────────────────
src/services/imageGenerationService.ts   # GarmentMetadata → controlled-vocab + measurements
                                          #   + graphics + brand/link/tags; device image save; pairing
src/services/wardrobeService.ts           # AddItemInput/Row gain type, fit, measurements(m_*),
                                          #   graphics, link(→source_url); addItem writes REAL type,
                                          #   color, fit, m_*, graphics, source='ai'; rowToItem maps back
src/services/extractByItemService.ts      # NEW (seam) — interface for the on-device "item" method;
                                          #   006 ships a stub; specs/extract-by-item implements it

# ── Types (MODIFIED) ──────────────────────────────────────────────────────────
src/types/fitEngine.ts   # WardrobeItem gains fit, measurements, graphics

# ── Feature: the wizard (NEW) ─────────────────────────────────────────────────
src/features/wardrobe-add/
├── index.ts
├── types.ts            # WizardStep, PhotoEntry(method,notes), ExtractedItem
│                       #   (controlled vocab + brand/link/tags/measurements/graphics), MeasureGroup
├── useAddWizard.ts     # state machine: upload→analyse→review→done; per-photo method+notes;
│                       #   analyse dispatches AI(imageGenerationService) or item(extractByItemService)
│                       #   per photo; review edit/remove; batch save (appStore); AI credit gate
├── vocab.ts            # UI label ↔ controlled-vocab maps (type/color/material/pattern)
├── measureSchema.ts    # type-aware groups + key→engine m_* column map + estimate plumbing
├── components/
│   ├── AddWizard.tsx        # shell: header + Stepper + step router + chooser overlay
│   ├── MethodChooser.tsx    # method (AI/item) → source (camera/library) → library multi-select
│   ├── UploadStep.tsx       # multi-photo rows: method badge + per-photo notes + add/remove
│   ├── ProcessingStep.tsx   # per-photo scan + progress strip + skeletons
│   ├── ReviewStep.tsx       # entries grouped by source photo
│   ├── ItemCard.tsx         # image + editable name/category/colour/fabric/brand/link + measurements + tags + remove
│   ├── DoneStep.tsx         # saved-count summary
│   ├── Stepper.tsx · FieldRow.tsx · Picker.tsx · MeasureField.tsx · TagEditor.tsx
└── __tests__/useAddWizard.test.ts

src/design/wardrobe-add/design.md         # NEW — wizard visual spec (tokens)

# ── Screens (MODIFIED) ────────────────────────────────────────────────────────
app/add-item.tsx          # render the wizard (full-screen) — thin; manual single-item add kept as fallback
app/(tabs)/wardrobe.tsx   # add affordance opens the wizard (MethodChooser)
app/(onboarding)/wardrobe-intro.tsx   # "Add first item" opens the wizard

# ── Removed (DEAD duplicate Claude path) ──────────────────────────────────────
supabase/functions/extract-garments/      # DELETE — never deployed
src/services/aiExtractionService.ts        # DELETE — only used by the dead hook
src/features/ai-extraction/useItemExtraction.ts   # DELETE/FOLD into useAddWizard
```

**Structure Decision**: One self-contained `src/features/wardrobe-add/` feature implements the wizard (Principles II, VI); both methods reach shared `src/services/` modules (Principle III). The AI pipeline lives in `generate-item-image` ↔ `imageGenerationService`; the on-device method is reached through `extractByItemService` (stub here, implemented by `specs/extract-by-item`). Shared domain types in `src/types/`. One new DB column; no new top-level projects.

## Complexity Tracking

> No Constitution violations introduced — section intentionally empty.
