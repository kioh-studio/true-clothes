import { findDemoAccount, DEMO_EMAIL, DEMO_PROFILE, DEMO_PROFILE_WOMAN } from '../demo';

describe('findDemoAccount', () => {
  it('matches the man account by exact email', () => {
    const acct = findDemoAccount(DEMO_EMAIL);
    expect(acct?.email).toBe(DEMO_EMAIL);
    expect(acct?.profile).toBe(DEMO_PROFILE);
  });

  it('matches the woman account by exact email', () => {
    const acct = findDemoAccount('demo-woman@mien.app');
    expect(acct?.email).toBe('demo-woman@mien.app');
    expect(acct?.profile).toBe(DEMO_PROFILE_WOMAN);
  });

  it('is case-insensitive', () => {
    expect(findDemoAccount(DEMO_EMAIL.toUpperCase())?.email).toBe(DEMO_EMAIL);
    expect(findDemoAccount('Demo-Woman@Mien.App')?.email).toBe('demo-woman@mien.app');
  });

  it('trims whitespace', () => {
    expect(findDemoAccount(`  ${DEMO_EMAIL}  `)?.email).toBe(DEMO_EMAIL);
  });

  it('returns undefined for a non-demo email', () => {
    expect(findDemoAccount('someone@example.com')).toBeUndefined();
  });
});
