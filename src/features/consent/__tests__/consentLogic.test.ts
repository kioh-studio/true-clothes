import { CONSENT_VERSIONS, isConsentValid, type ConsentRow } from '../consentLogic';

const V = CONSENT_VERSIONS.ai_photo;
const row = (isConsent: boolean, version = V): ConsentRow =>
  ({ version, isConsent, updatedAt: '2026-11-29T00:00:00Z' });

// The table holds current state (upsert), so grant->withdraw is the row flipping to false, etc.
describe('isConsentValid', () => {
  it('no row -> false', () => {
    expect(isConsentValid(null, 'ai_photo')).toBe(false);
  });
  it('granted with matching version -> true', () => {
    expect(isConsentValid(row(true), 'ai_photo')).toBe(true);
  });
  it('granted then withdrawn (is_consent=false) -> false', () => {
    expect(isConsentValid(row(false), 'ai_photo')).toBe(false);
  });
  it('withdrawn then re-granted (is_consent=true) -> true', () => {
    expect(isConsentValid(row(true), 'ai_photo')).toBe(true);
  });
  it('version mismatch -> false', () => {
    expect(isConsentValid(row(true, '2020-01-01'), 'ai_photo')).toBe(false);
  });
});
