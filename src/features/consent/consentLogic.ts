// Consent validity — pure rule (type-only imports; unit-tested).
// Bump a version whenever its copy changes materially (and in public.consents): everyone is asked again.
import type { ConsentId } from '../../types/consent';

export const AI_PHOTO_CONSENT_VERSION = '2026-11-29';

/** Current wording version per consent; must match public.consents.version. */
export const CONSENT_VERSIONS: Record<ConsentId, string> = {
  ai_photo: AI_PHOTO_CONSENT_VERSION,
};

/** The user_consents row for (user, consent): current state only (history lives in user_consent_history). */
export interface ConsentRow {
  version: string;
  isConsent: boolean;
  updatedAt: string;
}

/** Valid only if the row exists, is a grant, and matches the current version. */
export function isConsentValid(row: ConsentRow | null | undefined, consentId: ConsentId): boolean {
  return !!row && row.isConsent && row.version === CONSENT_VERSIONS[consentId];
}
