// Pure logic for the segmented OTP input (see app/(onboarding)/otp.tsx).
// Extracted so the keyboard-dismiss behavior is unit-testable without rendering
// the React Native screen (the jest harness is node-only, no RN renderer).

export const OTP_LENGTH = 6;

/** Sanitize a raw TextInput value to a single numeric digit (last char wins). */
export function sanitizeDigit(raw: string): string {
  return raw.replace(/\D/g, '').slice(-1);
}

/**
 * Decide what should happen after `clean` is entered at index `i`, given the
 * resulting digits array `next`:
 *  - 'advance' : a digit was entered and there's a next box → move focus forward
 *  - 'dismiss' : a digit was entered, it's the last box, and the code is complete
 *                → drop the keyboard (number-pad has no Done key)
 *  - 'none'    : nothing to do (e.g. the box was cleared)
 *
 * Mirrors the precedence used in the screen: advancing focus takes priority over
 * dismissing, so only completing the final box triggers dismissal.
 */
export type DigitAction = 'advance' | 'dismiss' | 'none';

export function digitAction(next: string[], i: number, clean: string): DigitAction {
  if (clean && i < next.length - 1) return 'advance';
  if (clean && next.every(d => d !== '')) return 'dismiss';
  return 'none';
}
