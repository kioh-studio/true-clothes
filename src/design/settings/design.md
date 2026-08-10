# Settings — Visual Spec (`app/settings.tsx`)

Per Constitution I (Luxury Minimalist Design): near-monochrome canvas, hairline
dividers only, serif headlines, no gradients/shadows. All colors/type via
`T.*` / `type.*` tokens (`src/design/tokens.ts`).

No prior design.md existed for this screen (it predates the per-feature
design-doc convention) — this file was created for the "4 suggestion
toggles" feature (2026-08-10) and documents the screen as a whole going
forward, not just the new section.

## Screen: `app/settings.tsx`

- **Header**: 56px nav row, hairline bottom border. Back chevron
  (`IconChevronLeft`, 20px, stroke 1.2) left, centered serif title
  `t('settings_title')`, empty 44×44 spacer right for symmetry.
- **Body**: single `ScrollView`, 24px horizontal padding, 32px top padding,
  wrapped in `Bounded` (max-width clamp on large screens).
- **Sections**, top to bottom: Preferences → **Suggestions** (new,
  2026-08-10) → Language → Account → Danger Zone → App.
- **Rows** (hairline-bordered, 18px vertical padding, `row`/`rowBody`/
  `rowTitle`/`rowDesc`): title (serif 17px) + one-line caption
  (`type.caption`, 12px, tertiary) on the left, control on the right.

## Suggestions section (new, 2026-08-10)

Sits directly under Preferences (`settings_suggestionsSection`, `type.ui`
10px tertiary label, identical treatment to `settings_preferencesSection`).
Four `Switch` rows, same primitive as every other toggle on this screen
(`trackColor={{ false: T.color.muted, true: T.color.primary }}`,
`thumbColor={T.color.canvas}`):

1. **Style match** (`settings_suggestByStyle`) — `suggest_by_style`
2. **Personal colour** (`settings_suggestByPersonalColor`) — `suggest_by_personal_color`
3. **Formula preference** (`settings_suggestByFormula`) — `suggest_by_formula`
4. **Body measurements** (`settings_suggestByMeasurements`) — `suggest_by_measurements`

Each caption states plainly what turning it off drops (see i18n
`settings_suggestBy*Desc` keys, en/vi). The measurements caption explicitly
notes that body-shape styling is a separate setting (the existing
"Body-neutral styling" row above) — turning measurements off does **not**
turn off body-shape-aware silhouette suggestions; that is a deliberate,
independently-controlled feature (see plan.md 2026-08-10 entry for the
non-UI rationale).

All four default ON (matches existing behavior for every current user) and
are independent — any combination may be off at once, including all four,
without blocking outfit generation.

## State

Bound to `useFitEngineStore`'s `suggestByStyle` / `suggestByPersonalColor` /
`suggestByFormula` / `suggestByMeasurements` + `setSuggestionToggles(patch)`
— the SAME store/table (`style_profiles`) and hydrate/persist pattern already
used for `formulaPreferences`, not `useAppStore` (which holds the
client-only, per-request `genderAwareStyling`/`bodyNeutralMode` flags right
above them on this same screen — a different persistence model, see plan.md).
No local component state, no debouncing: each `Switch.onValueChange` writes
straight through.

## Entry point: `app/(tabs)/profile.tsx`

The Profile screen's gear icon (`IconSettings`) routes to `/profile-edit`
(name/avatar/location), not `/settings` — those are different screens. Before
this feature, `/settings` was reachable only from the separate tabs-menu
overlay (`app/(tabs)/index.tsx`, `tabs_menu_settings` row). Profile itself had
no path there, so a `{ id: 'settings', labelKey: 'tabs_profile_settings',
route: '/settings' }` row was added to `SECTIONS`, last in the list (after
Subscription, before the Sign out / Danger Zone / App Info blocks below the
list).
