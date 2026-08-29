// Demo account — public identifiers only. The actual credential (the
// email:OTP whitelist and shared password) lives server-side as secrets on
// the `auth` edge function now, not here — see
// supabase/functions/auth/index.ts. This file only keeps the data the
// client still needs after a demo login succeeds: which profile to apply.
//
// Under the hood the demo no longer uses anonymous sign-in (disabled on the
// project). It signs into a fixed, email-confirmed Supabase user
// (demo@mien.app), so it has a STABLE uid that owns a pre-seeded wardrobe
// (32 items + cloud images).
export const DEMO_PHONE = '+84000000000';
export const DEMO_EMAIL = 'demo@mien.app';
export const DEMO_PROFILE = {
  fullName: 'Demo User',
  gender:   'MAN',
  dob:      '01/01/1995',
  location: 'Ho Chi Minh City, Vietnam',
} as const;

// Second demo account — same shared OTP/password UX, routes into a separate
// stable uid (demo-woman@mien.app) that owns its own pre-seeded womenswear
// wardrobe. See plan.md (2026-08-12) for the seeding details.
export const DEMO_PROFILE_WOMAN = {
  fullName: 'Demo Woman',
  gender:   'WOMAN',
  dob:      '15/03/1997',
  location: 'Ho Chi Minh City, Vietnam',
} as const;

export interface DemoAccount {
  email: string;
  profile: typeof DEMO_PROFILE | typeof DEMO_PROFILE_WOMAN;
}

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  { email: DEMO_EMAIL,             profile: DEMO_PROFILE },
  { email: 'demo-woman@mien.app',  profile: DEMO_PROFILE_WOMAN },
];

/** Case-insensitive, trimmed lookup. Returns undefined for non-demo emails. */
export function findDemoAccount(email: string): DemoAccount | undefined {
  const normalized = email.trim().toLowerCase();
  return DEMO_ACCOUNTS.find((acct) => acct.email.toLowerCase() === normalized);
}
