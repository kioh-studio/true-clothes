// Current consent state (public.user_consents, one row per user+consent, RLS: own rows).
// A DB trigger appends every change to public.user_consent_history (audit log, not client-writable).
import { sb } from './supabase';
import { getCurrentUserId } from './authService';
import { CONSENT_VERSIONS, type ConsentRow } from '../features/consent/consentLogic';
import type { ConsentId } from '../types/consent';

const TABLE = 'user_consents';

/** This user's row for the consent, or null if never answered. */
export async function getConsent(consentId: ConsentId): Promise<ConsentRow | null> {
  const { data, error } = await sb
    .from(TABLE)
    .select('version, is_consent, updated_at')
    .eq('consent_id', consentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const r = data as { version: string; is_consent: boolean; updated_at: string };
  return { version: r.version, isConsent: r.is_consent, updatedAt: r.updated_at };
}

async function save(consentId: ConsentId, version: string, isConsent: boolean): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Not signed in');
  const { error } = await sb
    .from(TABLE)
    .upsert(
      { user_id: userId, consent_id: consentId, version, is_consent: isConsent },
      { onConflict: 'user_id,consent_id' },
    );
  if (error) throw error;
}

export const grant = (consentId: ConsentId, version: string = CONSENT_VERSIONS[consentId]) =>
  save(consentId, version, true);
export const withdraw = (consentId: ConsentId, version: string = CONSENT_VERSIONS[consentId]) =>
  save(consentId, version, false);
