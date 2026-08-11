// Onboarding resume routing — pure logic, kept out of app/(onboarding)/index.tsx
// per CLAUDE.md's "screens are thin" convention.
//
// The bug this fixes: a user who abandons onboarding partway (has a valid
// session, i.e. already passed auth, but `onboardingComplete` is still false)
// was always sent back to the Welcome screen → Account (email) → OTP, forcing
// a pointless re-authentication before landing back on the SAME step they'd
// already reached — no data was lost, but every reopen meant re-doing auth.
//
// Progress signal: there is no dedicated "onboarding_step" column or similar
// checkpoint. Every step's own screen already persists its data immediately
// on Continue (profiles.gender/date_of_birth, profiles.location_city/country,
// body_measurements, the style/color rows in user_style_profile) — this
// reuses THAT existing data as the resume signal rather than inventing a new
// persistence scheme. That is a deliberate best-effort compromise, not a
// perfect one: every one of basics/location/measurements/styles is individually
// skippable, and a "Skip" tap does not always write a distinguishing sentinel
// (e.g. measurements' skip button just navigates on — see
// app/(onboarding)/measurements.tsx — with nothing saved at all). So a step
// that was genuinely skipped is indistinguishable here from one never reached,
// and resume will land the user back on it. That's an acceptable trade-off:
// it's a strict improvement over today's "always restart at auth", it exactly
// fixes the reported scenario (filled in up through `location`, killed the
// app before `measurements`), and worst case the user re-taps Skip once.
//
// If a future change needs perfect step tracking (e.g. to also distinguish
// "visited and skipped" from "never reached"), that needs a real persisted
// checkpoint (a new column/table) — out of scope here.
export interface OnboardingProgressSnapshot {
  gender: string;
  dob: string;
  location: string;
  bodyHeight: number | null | undefined;
  bodyWeight: number | null | undefined;
  selectedStyles: string[];
  colorPreferences: string[];
}

export type OnboardingResumeRoute =
  | '/(onboarding)/basics'
  | '/(onboarding)/location'
  | '/(onboarding)/measurements'
  | '/(onboarding)/styles'
  | '/(onboarding)/colors'
  | '/(onboarding)/complete';

/**
 * Resolve the first onboarding step whose data isn't on file yet, for a user
 * who already has a valid session (this must NEVER be called — and must
 * never route to `/account` or `/otp` — for a signed-out user; the auth
 * boundary is the caller's responsibility, see app/(onboarding)/index.tsx).
 */
export function resolveOnboardingResumeRoute(p: OnboardingProgressSnapshot): OnboardingResumeRoute {
  if (!p.gender.trim() && !p.dob.trim()) return '/(onboarding)/basics';
  if (!p.location.trim()) return '/(onboarding)/location';
  // Height + weight are the two REQUIRED fields on the measurements step
  // (see validateMeasurements / the "required" section of measurements.tsx).
  if (p.bodyHeight == null || p.bodyWeight == null) return '/(onboarding)/measurements';
  if (p.selectedStyles.length === 0) return '/(onboarding)/styles';
  if (p.colorPreferences.length === 0) return '/(onboarding)/colors';
  // Every step's data is on file but `onboardingComplete` is still false —
  // the user reached the end without tapping a completion CTA. Re-show
  // complete.tsx rather than forcing straight into tabs, since entering the
  // app still requires completeOnboarding() to actually run.
  return '/(onboarding)/complete';
}
