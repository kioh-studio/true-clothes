import * as fs from 'fs';
import * as path from 'path';
import { sanitizeDigit, digitAction, OTP_LENGTH, type DigitAction } from '../otpInput';

describe('otpInput — sanitizeDigit', () => {
  it('keeps a single numeric digit', () => {
    expect(sanitizeDigit('4')).toBe('4');
  });
  it('strips non-digits and keeps the last typed char (autofill / fast typing)', () => {
    expect(sanitizeDigit('a7')).toBe('7');
    expect(sanitizeDigit('12')).toBe('2');
  });
  it('returns empty string when cleared', () => {
    expect(sanitizeDigit('')).toBe('');
    expect(sanitizeDigit('x')).toBe('');
  });
});

describe('otpInput — digitAction', () => {
  it('advances focus while there is a next box', () => {
    expect(digitAction(['1', '', '', '', '', ''], 0, '1')).toBe('advance');
    expect(digitAction(['1', '2', '3', '4', '5', ''], 4, '5')).toBe('advance');
  });

  it('dismisses the keyboard when the LAST box completes a full code', () => {
    expect(digitAction(['1', '2', '3', '4', '5', '6'], 5, '6')).toBe('dismiss');
  });

  it('does nothing when a box is cleared', () => {
    expect(digitAction(['1', '2', '3', '4', '5', ''], 5, '')).toBe('none');
  });

  it('does not dismiss if the last box is filled but the code is incomplete', () => {
    // gap at index 2; user jumped to the last box
    expect(digitAction(['1', '2', '', '4', '5', '6'], 5, '6')).toBe('none');
  });
});

describe('otpInput — full typing simulation (the bug being fixed)', () => {
  it('dismisses the keyboard exactly once, on entry of the 6th digit', () => {
    let digits = Array(OTP_LENGTH).fill('');
    const dismiss = jest.fn();
    const focusNext = jest.fn();

    const code = ['1', '2', '3', '4', '5', '6'];
    code.forEach((char, i) => {
      const clean = sanitizeDigit(char);
      const next = [...digits];
      next[i] = clean;
      digits = next;
      const action: DigitAction = digitAction(next, i, clean);
      if (action === 'advance') focusNext();
      else if (action === 'dismiss') dismiss();
    });

    expect(dismiss).toHaveBeenCalledTimes(1);   // dropped once the code is complete
    expect(focusNext).toHaveBeenCalledTimes(5); // first five advance, sixth dismisses
    expect(digits.join('')).toBe('123456');
  });
});

describe('otp.tsx — tap-outside dismiss wrapper is present', () => {
  const src = fs.readFileSync(
    path.resolve(process.cwd(), 'app/(onboarding)/otp.tsx'),
    'utf8',
  );

  it('imports Keyboard and TouchableWithoutFeedback from react-native', () => {
    expect(src).toMatch(/import\s*{[^}]*\bKeyboard\b[^}]*}\s*from\s*'react-native'/);
    expect(src).toMatch(/import\s*{[^}]*\bTouchableWithoutFeedback\b[^}]*}\s*from\s*'react-native'/);
  });

  it('wraps the screen in TouchableWithoutFeedback that dismisses on press', () => {
    expect(src).toMatch(/<TouchableWithoutFeedback[^>]*onPress=\{Keyboard\.dismiss\}/);
  });

  it('dismisses the keyboard in the digit handler on completion', () => {
    expect(src).toContain('Keyboard.dismiss()');
  });
});
