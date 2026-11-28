// AI photo consent — pure validity rule (no imports; unit-tested).
// Bump the version whenever the consent copy changes materially: every user is then asked again.
export const AI_PHOTO_CONSENT_VERSION = '2026-11-29';

export interface AiPhotoConsentRow {
  version: string;
  grantedAt: string;
  withdrawnAt: string | null;
}

/** Valid only if the row exists, is not withdrawn, and matches the current copy version. */
export function isConsentValid(row: AiPhotoConsentRow | null | undefined): boolean {
  return !!row && row.withdrawnAt === null && row.version === AI_PHOTO_CONSENT_VERSION;
}
