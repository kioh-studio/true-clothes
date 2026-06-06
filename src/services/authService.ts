// Auth service — wraps Supabase auth so screens / stores never touch the
// client directly (per CLAUDE.md: "Supabase access only through service
// abstractions"). Phone OTP or email OTP — user needs only one.
import { sb } from './supabase';

export type AuthResult = { ok: true } | { ok: false; message: string };

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

export async function sendPhoneOtp(phoneE164: string): Promise<AuthResult> {
  const { error } = await sb.auth.signInWithOtp({
    phone: phoneE164,
    options: { shouldCreateUser: true },
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function verifyPhoneOtp(phoneE164: string, code: string): Promise<AuthResult> {
  const { error } = await sb.auth.verifyOtp({
    phone: phoneE164,
    token: code,
    type: 'sms',
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function sendEmailOtp(email: string): Promise<AuthResult> {
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function verifyEmailOtp(email: string, code: string): Promise<AuthResult> {
  const { error } = await sb.auth.verifyOtp({
    email,
    token: code,
    type: 'email',
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await sb.auth.getSession();
  return data.session?.user?.id ?? null;
}

export async function signOut(): Promise<void> {
  await sb.auth.signOut();
}
