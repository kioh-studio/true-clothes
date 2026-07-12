# Notifications — Visual Spec (Profile → Notifications)

Per Constitution I (Luxury Minimalist Design): near-monochrome canvas, hairline
dividers only, serif headlines, no gradients/shadows. All colors/type via
`T.*` / `type.*` tokens (`src/design/tokens.ts`).

## Screen: `app/notifications.tsx`

Layout mirrors `app/settings.tsx` exactly (same header + row primitives),
reached from the Profile screen's "Notifications" row (`app/(tabs)/profile.tsx`
SECTIONS, route `/notifications`).

- **Header**: 56px nav row, hairline bottom border. Back chevron
  (`IconChevronLeft`, 20px, stroke 1.2) left, centered serif title
  `t('notifications_title')`, empty 44×44 spacer right for symmetry.
- **Body**: single `ScrollView`, 24px horizontal padding, 32px top padding.
  One section, labelled `t('notifications_sectionLabel')` (`type.ui`, 10px,
  tertiary, matches `settings_preferencesSection` styling).
- **Rows** (hairline-bordered, 18px vertical padding, matches `settings.tsx`
  `row`/`rowBody`/`rowTitle`/`rowDesc`): each pairs a title + one-line
  description on the left with a `Switch` on the right
  (`trackColor={{ false: T.color.muted, true: T.color.primary }}`,
  `thumbColor={T.color.canvas}` — identical to every other toggle in the app).
  Order: Daily outfit → Weather changes → Wardrobe reminders → News & offers.
- **Footer note**: `type.caption`, `T.color.tertiary`, 24px top margin —
  a single reassurance line (`t('notifications_footerNote')`) stating
  preferences are local to the device. No CTA, no button — text only, per the
  app's convention for secondary/informational copy.

## State

All four toggles are bound directly to `appStore.notificationPrefs`
(persisted, defaults: `dailyOutfit: true, weather: true, wardrobe: true,
marketing: false`). `setNotificationPref(key, value)` is the sole write path —
no local component state, no debouncing (mirrors `settings.tsx`'s
`genderAwareStyling`/`bodyNeutralMode` switches).

## Explicitly out of scope (see `backlog.md`)

This screen only **records intent**. There is no `expo-notifications`
integration — no permission prompt, no OS-level scheduling, no push delivery.
Toggling a switch here does not currently cause any notification to actually
be sent.
