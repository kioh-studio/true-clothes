// Server-side proof of AI photo consent (public.ai_photo_consents, RLS: own row only).
import { sb } from './supabase';
import { getCurrentUserId } from './authService';
import { AI_PHOTO_CONSENT_VERSION, type AiPhotoConsentRow } from '../features/consent/consentLogic';

const TABLE = 'ai_photo_consents';

export async function getAiPhotoConsent(): Promise<AiPhotoConsentRow | null> {
  const { data, error } = await sb
    .from(TABLE)
    .select('version, granted_at, withdrawn_at')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const r = data as { version: string; granted_at: string; withdrawn_at: string | null };
  return { version: r.version, grantedAt: r.granted_at, withdrawnAt: r.withdrawn_at };
}

/** Insert or re-grant (new version / after withdrawal). Throws if signed out or on DB error. */
export async function grantAiPhotoConsent(): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Not signed in');
  const { error } = await sb.from(TABLE).upsert(
    {
      user_id: userId,
      version: AI_PHOTO_CONSENT_VERSION,
      granted_at: new Date().toISOString(),
      withdrawn_at: null,
    },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
}

export async function withdrawAiPhotoConsent(): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Not signed in');
  const { error } = await sb
    .from(TABLE)
    .update({ withdrawn_at: new Date().toISOString() })
    .eq('user_id', userId);
  if (error) throw error;
}
