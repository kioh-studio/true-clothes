# App Review Notes (paste into App Store Connect -> App Review Information -> Notes)

Source of truth: supabase/functions/auth, supabase/functions/delete-user, app/paywall.tsx, app.json.

```
DEMO SIGN-IN (shared review accounts)
1. Launch the app and tap through the welcome screen to the account screen.
2. Enter the email  demo@mien.app  (a second demo account, demo-woman@mien.app, also works) and tap Continue. No email is sent for demo accounts.
3. On the code screen enter the 6-digit code  000000  to sign in.
The app uses email one-time-code sign-in only (no password).

ACCOUNT DELETION
Settings -> Delete Account deletes the profile, wardrobe and all data.
The two demo accounts are shared review accounts, so for them Delete Account intentionally returns "This account cannot be deleted".
To test deletion, sign up with your own email address: enter it on the account screen and a real one-time code is emailed to it (new accounts are created automatically on first verification). Then go to Settings -> Delete Account.

SUBSCRIPTION / PAYWALL
Subscriptions are handled by RevenueCat with Apple in-app purchase, premium entitlement. Open the paywall from the Profile tab -> Subscription. It also opens from the upgrade button when a free-tier limit is reached (for example in wardrobe item adding and the try-on scan screen). Plans are shown from the current RevenueCat offering, with a Restore option. Sandbox purchases work.
Note: demo-woman@mien.app is a premium account, so its paywall shows an already-subscribed state. To see the purchase flow, use a fresh account you create with your own email.

PERMISSIONS (each is requested only when the related feature is used)
- Camera: "MIEN uses your camera to photograph clothing for your wardrobe, and to scan your face and body for colour analysis, measurements and virtual try-on."
- Photos: "MIEN needs access to your photos to add clothing items to your wardrobe."
- Location (when in use): "MIEN uses your location to tailor outfit suggestions to your local weather and season."
- Motion sensors: "MIEN uses motion sensors to check your phone is held upright while scanning your body measurements."
- Notifications: local outfit reminders only, requested when the user turns reminders on in the notification settings. No push server is used.
Microphone is not used.

PRIVACY
Body measurement (the body scan) runs fully on-device; body-scan photos are not uploaded. Separately, the optional virtual try-on feature sends a full-body photo and the garment image to Google Gemini for image generation.
```
