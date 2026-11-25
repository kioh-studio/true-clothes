# Notifications — Visual Spec (Profile → Notifications)

Per Constitution I (Luxury Minimalist Design): near-monochrome canvas, hairline
dividers only, serif headlines, no gradients/shadows. All colors/type via
`T.*` / `type.*` tokens (`src/design/tokens.ts`).

## Screen: `app/notifications.tsx` (thin; logic in `src/features/notifications/useNotificationSettings.ts`)

Reached from the Profile "Notifications" row (`route: '/notifications'`).
Same visual structure as `app/settings.tsx` / `app/location-weather.tsx`.

- **Header**: 56px nav row, hairline bottom border. Back chevron left,
  centered serif title, empty 44x44 spacer right.
- **Permission row** (only while OS permission is not granted): top hairline
  row "Turn on notifications" + one-line description. Tap requests permission;
  if the OS will not ask again, the description says so and the tap opens system
  Settings. Never shown a prompt at app launch.
- **Toggles** (section `notifications_sectionLabel`): Daily outfit, Weather
  changes, Wardrobe reminders. Title + description left, `Switch` right
  (`trackColor` muted/primary, `thumbColor` canvas). While permission is not
  granted the switches render OFF and disabled. The "News & offers" switch was
  removed (no delivery infrastructure); `notificationPrefs.marketing` stays in
  the store, unused.
- **Reminder time** (section `notifications_timeSection`): row of five preset
  chips (06:30, 07:00, 07:30, 08:00, 08:30). Hairline-bordered rectangles
  (radius 2); the active chip is filled primary with canvas text. No picker
  dependency. Applies to the daily outfit and the weather reminder.
- **Footer note**: `type.caption`, tertiary — reminders are scheduled on the
  device, nothing is sent from servers.

## Behaviour

- State: `appStore.notificationPrefs` (`setNotificationPref`), `appStore.reminderTime`
  (default `07:30`, persisted), OS permission read via `notificationService`.
- Delivery is local only (`expo-notifications`, no push token, no server).
  `src/features/notifications/syncReminders.ts` cancels our three identifiers
  (`mien.daily`, `mien.weather`, `mien.wardrobe`) and reschedules from
  `planReminders` (pure, tested). Triggered by `useReminderSync` (root layout) on:
  hydration/login, pref or time change, language change, successful weather
  refresh, wardrobe change, app foreground. Logout or revoked permission cancels
  everything.
- Reminders:
  - Daily outfit: DAILY repeating at the reminder time, opens Home.
  - Weather: one-shot the evening before (today 20:00; if already past, 30 minutes
    from now only when that is still before 22:00, else skipped), only when tomorrow's
    forecast has rain probability >= 60%, a feels-like max differing by >= 6 C
    from today, or a different temperature band. Needs a weather location.
  - Wardrobe: WEEKLY Sunday 19:00, only when >= 3 items are "not worn lately"
    (same logic as `wardrobe-stats`); copy includes the count; opens
    `/wardrobe-stats`.
- Android channel `reminders` (default importance). Tapping a notification
  routes to its `data.route` via expo-router.
