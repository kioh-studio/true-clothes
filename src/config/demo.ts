// Demo account — bypasses real OTP for testing/demo purposes.
// Phone: +84 000 000 000   Email: demo@mien.app   OTP: 000000
//
// Under the hood the demo no longer uses anonymous sign-in (disabled on the
// project). It signs into a fixed, email-confirmed Supabase user
// (demo@mien.app) via password, so it has a STABLE uid that owns a pre-seeded
// wardrobe (32 items + cloud images). The password is a baked-in shared demo
// credential supplied via EXPO_PUBLIC_DEMO_PASSWORD (see .env / eas.json env).
export const DEMO_PHONE = '+84000000000';
export const DEMO_EMAIL = 'demo@mien.app';
export const DEMO_OTP   = '000000';
export const DEMO_PASSWORD = process.env.EXPO_PUBLIC_DEMO_PASSWORD ?? '';
export const DEMO_PROFILE = {
  fullName: 'Demo User',
  gender:   'MAN',
  dob:      '01/01/1995',
  location: 'Ho Chi Minh City, Vietnam',
} as const;
