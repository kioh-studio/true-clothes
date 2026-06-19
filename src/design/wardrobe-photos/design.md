# Wardrobe Photos — Visual & Interaction Spec

Feature 003-upload-image. UI surfaces for tiered item-photo storage. All values
reference `src/design/tokens.ts` — no inline hex.

## Photo placeholder (missing / loading)

Reuses the existing `PhotoFallback` primitive (`src/components/ui/Photo.tsx`):

- Background: muted tonal swatch (token-derived `TONES`); label in `T.color.tertiary`, `type.micro`.
- Shown whenever `useItemPhoto` returns `status !== 'ready'` (missing local file, cloud
  fetch failure, or offline-uncached cloud photo).
- No spinners, no broken-image icon — a calm fallback consistent with luxury-minimal tone.

## On-device-only disclosure (FR-017, free tier)

Location: `app/add-item.tsx`, directly beneath the selected photo, above the form.

- Container: `T.color.elevated` band, hairline bottom border, `PAD` horizontal padding.
- Copy (`type.caption`, `T.color.tertiary`): “Stored on this device only. This photo —
  and outfit suggestions that use it — won't appear on your other devices. Upgrade for cloud backup.”
- **Non-blocking**: informational only; never gates saving. Shown only when `!isPremium` and a photo is selected.
- Premium users see no disclosure (their photos are cloud-backed).

## Rendering contract

- Every item-photo surface (wardrobe grid; future item detail / collage for real items)
  renders via `useItemPhoto(item)` → `{ source, status }`.
- `status === 'ready'` → `<Image source={source} resizeMode="cover">`; otherwise `PhotoFallback`.
- Premium repeat views resolve from the on-device cache (instant, offline-capable).

## Motion

None added — photos appear on resolve without animation, consistent with the deliberate, still aesthetic.
