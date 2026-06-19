<!--
  SYNC IMPACT REPORT
  ==================
  Version Change: INITIAL → 1.0.0

  Modified Principles: N/A (initial creation from codebase analysis)

  Added Sections:
  - Core Principles I–VI: Luxury Minimalist Design, Thin Screens & Logic Separation,
    Service Abstraction Layer, Type Safety & Domain Integrity,
    Dual-Persistence Architecture, Feature Self-Containment
  - Tech Stack & Platform Constraints
  - Development Workflow & Documentation Policy
  - Governance

  Removed Sections: N/A

  Templates Reviewed:
  - ✅ .specify/templates/plan-template.md — Constitution Check section is a runtime
    placeholder; 6 gates defined in this constitution will populate it at plan-time.
    Mobile path Option 3 already present. No structural changes required.
  - ✅ .specify/templates/spec-template.md — Aligns with FR format and user story model.
    No structural changes required.
  - ✅ .specify/templates/tasks-template.md — Added Expo Router path convention
    (`app/`, `src/`, `supabase/functions/`, `src/**/__tests__/`) alongside existing
    native mobile option.
  - ✅ No command files found in .specify/templates/commands/

  Deferred TODOs: None
-->

# MIEN Constitution

## Core Principles

### I. Luxury Minimalist Design (NON-NEGOTIABLE)

Every screen, component, and interaction MUST conform to the design system defined
in `src/design/tokens.ts`. Inline hex values in `StyleSheet` objects are a violation.

- **Typography**: Cormorant Garamond (300 Light / 400 Regular) for headlines;
  Inter (400 Regular / 500 Medium) for body and UI labels. No other typefaces.
- **Color**: Near-monochrome base only — Canvas `#FAF7F2`, Primary `#1A1815`,
  Elevated `#F2EDE4`. Accent colors MUST reference token constants, not raw hex.
- **Spacing**: 4 px grid via `T.s(n)`. Generous padding. Crowded layouts are violations.
- **Motion**: Slow, deliberate transitions only. Spring or bounce animations are
  not permitted.
- **Icons**: Hairline SVG strokes (1.4–2 px width). Filled or solid icons are violations.
- **Imagery**: Full-bleed, unframed. Outfit and clothing photos MUST dominate the viewport.
- **No gradients**. No drop shadows unless structural elevation requires it (e.g., modal
  sheets) and the shadow is near-invisible.

**Rationale**: MIEN is positioned alongside Celine, The Row, and Bottega Veneta.
Any visual deviation degrades brand equity in a category where aesthetic trust is the
primary conversion lever.

**Constitution Gate**: Any PR introducing a new screen or component MUST demonstrate
design token compliance before merge.

---

### II. Thin Screens / Logic Separation (NON-NEGOTIABLE)

Screen files in `app/` MUST be pure view layers. They render state and dispatch
actions — nothing else.

- Business logic MUST live in Zustand stores (`src/stores/`) or feature hooks
  (`src/features/**/use*.ts`).
- Data transformation MUST live in service modules (`src/services/`).
- Inline `async`/`await` inside JSX event handlers is a violation; async work
  MUST be delegated to store actions.
- Derived state MUST be computed in hooks or selectors, never inline in render
  functions.
- No `useState` for data that belongs in a store (auth state, wardrobe items,
  style preferences, outfit lists).

**Rationale**: Screens are the most frequently iterated artifacts. Thin screens
allow design changes without touching logic, and logic changes without risking
UI regressions.

---

### III. Service Abstraction Layer (NON-NEGOTIABLE)

The Supabase client singleton (`src/services/supabase.ts`) MUST never be imported
directly from screens, components, or stores.

- All database reads and writes MUST go through service modules:
  `authService`, `profileService`, `measurementService`, `styleProfileService`,
  and any future domain-specific service.
- Edge Function invocations MUST be triggered from store actions, not from screens.
- Service functions MUST return typed domain objects in camelCase. Raw Supabase
  row shapes (snake_case) MUST remain internal to the service layer.
- camelCase ↔ snake_case conversion is the exclusive responsibility of service modules.

**Rationale**: Centralising Supabase access prevents vendor lock-in surface spread,
centralises error handling, and ensures backend schema changes remain non-breaking
to the UI layer.

---

### IV. Type Safety & Domain Integrity (NON-NEGOTIABLE)

TypeScript strict mode is active (`tsconfig.json`). `any` is not permitted in
production code.

- **Units**: Measurements MUST be stored and passed in metric (cm, kg) throughout
  the system. Imperial conversion is a UI display concern only, handled at render time.
- **Color tones**: Colors MUST be stored as named string values (e.g., `"Cream"`,
  `"Navy"`, `"Olive"`). Hex codes belong exclusively in `src/design/tokens.ts`.
- **DB naming**: Service modules own all camelCase ↔ snake_case conversion.
  snake_case shapes MUST NOT leak into domain types or store state.
- **Shared types**: Shared domain interfaces MUST be defined in `src/types/`.
  Features MAY define local-only types but MUST NOT redefine shared domain entities.
- **No `any`**: Where a type is unknown, use `unknown` and narrow with a type guard.

**Rationale**: The fit engine's correctness depends entirely on consistent unit and
color representations across client and server. Untyped or inconsistently typed data
causes silent scoring failures that are difficult to trace.

---

### V. Dual-Persistence Architecture

The app operates on a **local-first, async-sync** model.

- Zustand stores hold authoritative in-memory state.
- AsyncStorage is the local persistence layer for all stores (via Zustand persist
  middleware). Local reads are synchronous and instant.
- Supabase is the remote source of truth. Stores sync to it asynchronously after
  local updates.
- **No rollback mechanism exists.** Local and remote state can diverge on network
  failure. This is an accepted MVP trade-off and MUST be addressed before v2.
- The fit engine MUST run server-side (Edge Function at
  `supabase/functions/generate-outfits/`). The client-side copy in
  `src/services/fitEngine/` exists for debugging and UI display only.
- **Any scoring logic change MUST be applied to both locations simultaneously.**
  Partial updates that leave the client and server engines diverged are violations.
- Engine duplication is tracked in `docs/engine-migration-plan.md` and is scheduled
  for consolidation in a future release.

**Rationale**: Local-first ensures the app is responsive and usable without network
access. Server-side scoring ensures the computationally intensive ranking pipeline
does not block the UI thread.

---

### VI. Feature Self-Containment

Each product feature MUST be self-contained under `src/features/<feature-name>/`.

- A feature module owns: its local components, hooks (`use*.ts`), and
  feature-specific types.
- Features MUST NOT import directly from other feature modules. Cross-feature
  communication MUST go through shared Zustand stores or service calls.
- Reusable UI primitives belong in `src/components/ui/`.
  Shared domain components (e.g., outfit cards, collages) belong in
  `src/components/<domain>/`.
- `src/components/` is presentational only — no business logic.

**Rationale**: Self-contained features can be developed, tested, and removed
independently. Direct cross-feature imports create implicit coupling that violates
this property and makes refactoring unpredictably risky.

---

## Tech Stack & Platform Constraints

**Platform**: iOS + Android via React Native with Expo SDK.
No web target is in scope.

**Language**: TypeScript strict mode. No `.js` files are permitted in `src/` or `app/`.

**Navigation**: Expo Router (file-based). Stack and Tab navigators only.
Custom navigation logic outside `app/_layout.tsx` is not permitted.

**State Management**: Zustand v5 with AsyncStorage persist middleware.
Redux is not permitted.

**Local Persistence**: AsyncStorage via Zustand persist for store state.
`expo-sqlite` for future structured local data. MMKV may be introduced if
profiled performance constraints require it.

**Backend**: Supabase (Auth, PostgreSQL, Storage, Edge Functions). No other
backend services are in scope for MVP.

**Edge Functions**: Deno runtime (Supabase). Node.js Edge Functions are not permitted.

**Image Handling**: `expo-image-picker` for capture and selection.
Supabase Storage for remote persistence. Local-only image storage is a known MVP
gap tracked for resolution in v1.1.

**Fonts**: Cormorant Garamond and Inter loaded via `expo-font` in `app/_layout.tsx`.
System fonts MUST NOT be used in UI components.

**Performance Targets**:
- Outfit feed MUST render at 60 fps.
- Edge Function response MUST complete within 3 seconds on a warm instance.
- App cold-start to interactive MUST be under 3 seconds on mid-range devices.

---

## Development Workflow & Documentation Policy

**Documentation split** (canonical rule from `CLAUDE.md`):

- UI, visual, and interaction changes → document in `src/design/**/design.md`.
- Non-UI logic (data, backend, domain, validation) changes → document in `plan.md`.
- Documentation MUST be updated in the same session as the code change.

**Schema changes**: All Supabase schema changes MUST produce a SQL migration file
in `supabase/migrations/`. Schema changes documented only in markdown are violations.

**Demo account**: The demo account (`src/config/demo.ts`) MUST remain functional at
all times. It is the primary manual testing entry point.

**Onboarding gating**: The `onboardingComplete` flag in `authStore` is the sole gate
between the onboarding stack and the main app. Screen-level routing overrides to
bypass this gate are not permitted.

**Constitution Check gates** — evaluate for every plan before implementation:

1. Does the feature introduce a new screen or component?
   → Verify design token compliance (Principle I).
2. Does the feature add business logic?
   → Confirm it lives in a store or hook, not in JSX (Principle II).
3. Does the feature touch Supabase?
   → Confirm all access goes through a service module (Principle III).
4. Does the feature add a new entity, measurement field, or color representation?
   → Confirm the type is in `src/types/`, units are metric, colors are named strings
   (Principle IV).
5. Does the feature change scoring or ranking logic?
   → Confirm the change is applied to both `src/services/fitEngine/` and
   `supabase/functions/generate-outfits/engine/` (Principle V).
6. Does the feature span multiple product domains?
   → Confirm cross-domain communication flows through stores, not direct feature
   imports (Principle VI).

---

## Governance

This constitution supersedes all other practices, including inline comments,
prior conventions, and any contradictory guidance in documentation.

Amendments MUST include: (a) the principle or section affected, (b) the rationale
for the change, and (c) a migration plan for existing code that violates the new
rule. Amendments without a migration plan are invalid.

Version bumps follow semantic versioning:

- **MAJOR**: Principle removed, fundamentally redefined, or governance restructured
  in a backward-incompatible way.
- **MINOR**: New principle or section added; material expansion of existing guidance.
- **PATCH**: Clarification, wording fix, or non-semantic refinement.

All pull requests MUST include a Constitution Check in their feature plan
(see `.specify/templates/plan-template.md`). Complexity violations — such as
cross-feature imports, direct Supabase calls from screens, or `any` usage — MUST
be documented in the plan's Complexity Tracking table with explicit justification
before the PR can be reviewed.

Guidance file for runtime development: `CLAUDE.md` (project root).

**Version**: 1.0.0 | **Ratified**: 2026-06-06 | **Last Amended**: 2026-06-06
