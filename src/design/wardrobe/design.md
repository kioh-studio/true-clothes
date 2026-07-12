# Wardrobe — Visual Design Spec

**Feature**: Wardrobe sync to Supabase  
**Updated**: 2026-06-06

---

## Sync States

### Upload In Progress
- Item thumbnail shows a subtle `ActivityIndicator` (size `"small"`, color `T.color.tertiary`) overlaid in the top-right corner of the thumbnail.
- No opacity change on the thumbnail itself — the indicator is additive, not a replacement.
- Background persists as `T.color.elevated` if no photo has loaded yet.

### Sync Error State
- Item thumbnail shows a hairline red border (`T.color.error`, `borderWidth: 0.5`).
- Small error icon (12×12, `T.color.error`, hairline stroke) overlaid bottom-right.
- Tap anywhere on the item → retry the upload and clear the error badge.
- Error text displayed below the grid item: `type.micro`, `T.color.error`.

### First-Boot Migration Overlay
- Full-screen overlay on `T.color.canvas` background, `zIndex: 9999`.
- Single line of text, centred vertically: `"Syncing your wardrobe…"` — `type.h2`, `T.font.serifLight`, weight 300, `T.color.primary`.
- Progress counter below: `"{done} / {total}"` — `type.caption`, `T.color.tertiary`, letterSpacing 1.
- No button, no dismiss — overlay auto-removes when migration completes.
- Blocks all navigation until `migrationProgress` returns to `null` in `appStore`.

### Delete Error (Item Detail)
- If `removeWardrobeItem` fails, stay on the item detail screen and show a system `Alert` with the `wardrobeError` message. Do not navigate back on failure.

### Offline Rejection Toast
- When `addWardrobeItem()` is called without an internet connection, `wardrobeError` is set to `"Adding items requires an internet connection"`.
- Display as an inline banner at the top of the Add Item screen: `type.caption`, `T.color.warning` text, `T.color.canvas` background, hairline bottom border.
- Auto-dismisses when the user attempts another action or navigates away (no timer needed).
- Never modifies `wardrobeItems` state — rejected silently at the store level.

---

## Typography & Colour Reference

| Role | Token |
|---|---|
| Overlay background | `T.color.canvas` |
| Primary text | `T.color.primary` |
| Secondary text | `T.color.tertiary` |
| Error accent | `T.color.error` |
| Warning accent | `T.color.warning` |
| Sync indicator | `T.color.tertiary` |
| Hairline borders | `T.color.hairline` |
