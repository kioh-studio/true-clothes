// analytics — PostHog product analytics wrapper. THE ONLY file that imports
// posthog-react-native. Everything is a guarded no-op until
// EXPO_PUBLIC_POSTHOG_KEY is set (see .env / eas.json — currently empty
// placeholders, same pattern as EXPO_PUBLIC_SENTRY_DSN in app/_layout.tsx):
// require() is wrapped in try/catch so a native-module mismatch never
// crashes the app, init only runs once a key exists, and every exported
// function swallows its own errors so a broken analytics call can never
// break a real user action.
//
// PRIVACY (hard constraint — see CLAUDE.md + project memory "Body data
// on-device only"): body measurements and on-device photos must never leave
// the device, and no PII (email/phone/name) is sent either. scrubProps()
// below defensively drops any prop whose KEY looks like it could hold that
// data, regardless of caller intent — the allowlist-by-exclusion runs on
// every track() call, not just the ones callers remember to sanitise.
// Session replay and autocapture (touch/text capture requires mounting
// PostHogProvider, which this file deliberately never does) are both off.

let PostHog: typeof import('posthog-react-native').default | null = null;
try { PostHog = require('posthog-react-native').default; } catch { /* not resolvable in this runtime */ }

let client: InstanceType<NonNullable<typeof PostHog>> | null = null;

try {
  const apiKey = process.env['EXPO_PUBLIC_POSTHOG_KEY'];
  if (PostHog && apiKey) {
    const host = process.env['EXPO_PUBLIC_POSTHOG_HOST'] || 'https://us.i.posthog.com';
    client = new PostHog(apiKey, {
      host,
      captureAppLifecycleEvents: true,
      enableSessionReplay: false, // session replay OFF (hard privacy constraint)
      // No PostHogProvider is mounted anywhere in the app, so autocapture of
      // touches/text never runs regardless of its (false) default.
    });
  }
} catch { /* never let analytics init crash app startup */ }

export type AnalyticsEvent =
  | 'onboarding_step_completed'
  | 'onboarding_completed'
  | 'item_added'
  | 'outfit_saved'
  | 'outfit_worn'
  | 'try_on_started'
  | 'try_on_completed'
  | 'try_on_failed'
  | 'wardrobe_report_opened'
  | 'verdict_viewed'
  | 'paywall_viewed'
  | 'purchase_completed'
  | 'feedback_submitted'
  | 'outfit_built'
  | 'mix_match_used'
  | 'outfit_scheduled'
  | 'wishlist_item_added'
  | 'collection_created'
  | 'item_deleted'
  | 'measurements_updated'
  | 'personal_color_completed'
  | 'notification_opened';

export type AnalyticsProps = Record<string, string | number | boolean>;

// Drops any prop key that could plausibly carry body measurements, photos/
// URIs, skin/hair/undertone data, or PII (email/phone/name/free text).
// Exported for the test in __tests__/analytics.test.ts.
const FORBIDDEN_KEY_RE = /(body_|measure|photo|uri|image|skin|hair|undertone|email|phone|name|message|text)/i;

export function scrubProps(props?: AnalyticsProps): AnalyticsProps | undefined {
  if (!props) return undefined;
  const out: AnalyticsProps = {};
  for (const [key, value] of Object.entries(props)) {
    if (FORBIDDEN_KEY_RE.test(key)) continue;
    out[key] = value;
  }
  return out;
}

export function track(name: AnalyticsEvent, props?: AnalyticsProps): void {
  try {
    client?.capture(name, scrubProps(props));
  } catch { /* never throw into a caller's success path */ }
}

export function screen(name: string): void {
  try {
    client?.screen(name);
  } catch { /* noop */ }
}

// Only ever passed the Supabase user uuid — no person properties (name/
// email/phone) attached, per the privacy constraint above.
export function identify(userId: string): void {
  try {
    client?.identify(userId);
  } catch { /* noop */ }
}

export function resetAnalytics(): void {
  try {
    client?.reset();
  } catch { /* noop */ }
}
