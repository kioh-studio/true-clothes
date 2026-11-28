# AI photo consent (2026-11-29)

Shown ONCE, the first time a feature sends a photo to Google Gemini (try-on, or AI item recognition when adding to the wardrobe). Remembered afterwards; withdrawable in Settings.

- **Surface**: native `Modal` (fade), bottom-anchored canvas panel, 0.5pt hairline top border, no shadow, no gradient. Mounted once in `app/_layout.tsx` (`AiPhotoConsentHost`) so it sits above any screen.
- **Type**: title in `type.h2` Cormorant light ("Your photo, your call."); body `type.body` secondary, 22 line height. Body scrolls; buttons stay pinned.
- **Checkbox**: 20pt hairline square, inner 10pt square when ticked; NOT pre-ticked. `AGREE AND CONTINUE` (PrimaryButton) disabled until ticked. `NOT NOW` (SecondaryButton) aborts quietly: nothing is sent, the feature does not run.
- **Privacy Policy** TextLink under the buttons (`PRIVACY_URL`, `/vi/` variant when the language is Vietnamese).
- **Copy elements** (all required): purpose (both features named), data type + sensitive/biometric, recipient Google (Gemini), servers outside Vietnam, no training, not shared, storage/deletion, withdraw in Settings, consequence of declining. Keys `consent_*` in en/vi.
- **Settings**: section "AI photo consent" shows granted / not granted; when granted a "Withdraw consent" row opens a confirm Alert. After withdrawal the next photo feature asks again.
- **Motion**: single slow fade, no bounce.
