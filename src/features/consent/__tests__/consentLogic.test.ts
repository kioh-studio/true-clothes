import { AI_PHOTO_CONSENT_VERSION, isConsentValid } from '../consentLogic';

const row = { version: AI_PHOTO_CONSENT_VERSION, grantedAt: '2026-11-29T00:00:00Z', withdrawnAt: null };

describe('isConsentValid', () => {
  it('accepts a current, non-withdrawn row', () => {
    expect(isConsentValid(row)).toBe(true);
  });
  it('rejects a missing row', () => {
    expect(isConsentValid(null)).toBe(false);
  });
  it('rejects a withdrawn row', () => {
    expect(isConsentValid({ ...row, withdrawnAt: '2026-11-30T00:00:00Z' })).toBe(false);
  });
  it('rejects a version mismatch', () => {
    expect(isConsentValid({ ...row, version: '2020-01-01' })).toBe(false);
  });
});
