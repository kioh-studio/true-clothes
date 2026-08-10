/**
 * Zero reads as a quiet dash rather than a bare "0" — a brand-new account's
 * empty stats should look like an intentional, calm empty state (luxury
 * minimalism) rather than a broken/loading number. Mirrors profile.tsx's
 * existing '—' fallback for a missing display name/phone/email.
 *
 * Kept in its own dependency-free module (no zustand/RN imports) so it can
 * be unit-tested without pulling in appStore's native module graph
 * (NetInfo, expo-localization, …) — see useProfileStats.ts, which re-exports
 * this for screen consumers.
 */
export function formatStatValue(n: number): string {
  return n > 0 ? String(n) : '—';
}
