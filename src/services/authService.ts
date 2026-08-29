// Auth service — wraps Supabase auth so screens / stores never touch the
// client directly (per CLAUDE.md: "Supabase access only through service
// abstractions"). Phone OTP or email OTP — user needs only one.
//
// send/verify go through the `auth` edge function instead of sb.auth.*
// directly — it's the one place that knows about demo whitelist accounts,
// so the demo OTP/password never has to ship in this bundle. The function
// itself just calls Supabase Auth's own signInWithOtp/verifyOtp/
// signInWithPassword and hands back the resulting session; setSession below
// is what actually makes it live in this client.
import { FunctionsHttpError } from '@supabase/supabase-js';
import { sb } from './supabase';

export type AuthResult =
  | { ok: true; isDemo?: boolean }
  | { ok: false; message: string };

interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  isDemo?: boolean;
}

// functions.invoke() collapses every non-2xx response into a generic
// FunctionsHttpError('Edge Function returned a non-2xx status code') —
// the actual `{ error: string }` body the `auth` function sent (Supabase's
// own OTP error text, or "Invalid demo credentials") only lives in
// `error.context`, the raw Response. Unwrap it so the user sees that
// message instead of the generic one.
async function edgeErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      if (typeof body?.error === 'string') return body.error;
    } catch {
      // context wasn't JSON (or already consumed) — fall through to generic message.
    }
  }
  return error instanceof Error ? error.message : 'Unknown error';
}

/** Normalize Vietnamese phone input to E.164 (+84xxxxxxxxx). */
export function toE164(raw: string): string | null {
  const d = (raw || '').replace(/[^\d+]/g, '');
  if (!d) return null;
  if (d.startsWith('+')) return d;
  if (d.startsWith('84')) return '+' + d;
  if (d.startsWith('0'))  return '+84' + d.slice(1);
  if (d.length >= 9)      return '+84' + d; // bare subscriber digits
  return null;
}

async function applySession(data: AuthSession | null, error: unknown): Promise<AuthResult> {
  if (error) return { ok: false, message: await edgeErrorMessage(error) };
  if (!data) return { ok: false, message: 'No session returned' };
  const { error: setError } = await sb.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
  if (setError) return { ok: false, message: setError.message };
  return { ok: true, isDemo: data.isDemo };
}

export async function sendPhoneOtp(phoneE164: string): Promise<AuthResult> {
  const { error } = await sb.functions.invoke('auth/send-otp', { body: { phone: phoneE164 } });
  if (error) return { ok: false, message: await edgeErrorMessage(error) };
  return { ok: true };
}

export async function verifyPhoneOtp(phoneE164: string, code: string): Promise<AuthResult> {
  const { data, error } = await sb.functions.invoke('auth/verify-otp', { body: { phone: phoneE164, code } });
  return applySession(data as AuthSession | null, error);
}

export async function sendEmailOtp(email: string): Promise<AuthResult> {
  const { error } = await sb.functions.invoke('auth/send-otp', { body: { email } });
  if (error) return { ok: false, message: await edgeErrorMessage(error) };
  return { ok: true };
}

export async function verifyEmailOtp(email: string, code: string): Promise<AuthResult> {
  const { data, error } = await sb.functions.invoke('auth/verify-otp', { body: { email, code } });
  return applySession(data as AuthSession | null, error);
}

export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await sb.auth.getUser();
  return data.user?.id ?? null;
}

export async function signOut(): Promise<void> {
  await sb.auth.signOut();
}
