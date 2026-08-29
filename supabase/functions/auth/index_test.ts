// Deno test suite for auth/index.ts's pure helpers.
// Run: deno test supabase/functions/auth/
//
// Deliberately does NOT test the Supabase Auth calls (signInWithOtp,
// verifyOtp, signInWithPassword) — that's Supabase's own code. Covers only
// the demo-whitelist parsing/resolution logic, which is this function's one
// piece of custom behavior.

import { assertEquals, assert } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { parseWhitelist, resolveDemoMatch, getClientIp } from './index.ts';

const DEMO_PHONE = '+84000000000';

// ─── parseWhitelist ───────────────────────────────────────────────────────────

Deno.test('parseWhitelist: multiple pairs', () => {
  const map = parseWhitelist('demo@mien.app:123456,demo-woman@mien.app:654321');
  assertEquals(map.size, 2);
  assertEquals(map.get('demo@mien.app'), '123456');
  assertEquals(map.get('demo-woman@mien.app'), '654321');
});

Deno.test('parseWhitelist: tolerates extra whitespace around email/otp', () => {
  const map = parseWhitelist(' demo@mien.app : 123456 , demo-woman@mien.app:654321 ');
  assertEquals(map.get('demo@mien.app'), '123456');
  assertEquals(map.get('demo-woman@mien.app'), '654321');
});

Deno.test('parseWhitelist: skips malformed pairs without throwing', () => {
  // "no-colon" has no ':'; the empty-email and empty-otp pairs are dropped too.
  const map = parseWhitelist('demo@mien.app:123456,no-colon,:456,foo@bar.com:');
  assertEquals(map.size, 1);
  assertEquals(map.get('demo@mien.app'), '123456');
});

Deno.test('parseWhitelist: OTP containing ":" still parses (splits on first ":" only)', () => {
  const map = parseWhitelist('demo@mien.app:12:34:56');
  assertEquals(map.get('demo@mien.app'), '12:34:56');
});

Deno.test('parseWhitelist: empty input yields empty map', () => {
  assertEquals(parseWhitelist('').size, 0);
});

// ─── resolveDemoMatch ─────────────────────────────────────────────────────────

const whitelist = parseWhitelist('demo@mien.app:123456,demo-woman@mien.app:654321');

Deno.test('resolveDemoMatch: exact email match', () => {
  const match = resolveDemoMatch(whitelist, { email: 'demo@mien.app' }, DEMO_PHONE);
  assertEquals(match?.email, 'demo@mien.app');
  assertEquals(match?.otp, '123456');
});

Deno.test('resolveDemoMatch: case-insensitive email match', () => {
  const match = resolveDemoMatch(whitelist, { email: 'DEMO-WOMAN@Mien.App' }, DEMO_PHONE);
  assertEquals(match?.email, 'demo-woman@mien.app');
  assertEquals(match?.otp, '654321');
});

Deno.test('resolveDemoMatch: trims whitespace around email', () => {
  const match = resolveDemoMatch(whitelist, { email: '  demo@mien.app  ' }, DEMO_PHONE);
  assertEquals(match?.email, 'demo@mien.app');
});

Deno.test('resolveDemoMatch: DEMO_PHONE maps to the first whitelist entry', () => {
  const match = resolveDemoMatch(whitelist, { phone: DEMO_PHONE }, DEMO_PHONE);
  assertEquals(match?.email, 'demo@mien.app');
  assertEquals(match?.otp, '123456');
});

Deno.test('resolveDemoMatch: unknown email returns undefined', () => {
  assertEquals(resolveDemoMatch(whitelist, { email: 'someone@example.com' }, DEMO_PHONE), undefined);
});

Deno.test('resolveDemoMatch: unknown phone returns undefined', () => {
  assertEquals(resolveDemoMatch(whitelist, { phone: '+84999999999' }, DEMO_PHONE), undefined);
});

Deno.test('resolveDemoMatch: empty whitelist never matches DEMO_PHONE', () => {
  assertEquals(resolveDemoMatch(new Map(), { phone: DEMO_PHONE }, DEMO_PHONE), undefined);
});

// ─── OTP must match its OWN pair — the core anti-auto-pass guarantee ────────

Deno.test('OTP cross-check: demo-woman OTP does not resolve/open demo account', () => {
  const match = resolveDemoMatch(whitelist, { email: 'demo@mien.app' }, DEMO_PHONE);
  assert(match);
  assertEquals(match.otp === '654321', false); // demo-woman's OTP must not match demo@'s pair
  assertEquals(match.otp, '123456');
});

Deno.test('OTP cross-check: demo OTP does not resolve/open demo-woman account', () => {
  const match = resolveDemoMatch(whitelist, { email: 'demo-woman@mien.app' }, DEMO_PHONE);
  assert(match);
  assertEquals(match.otp === '123456', false); // demo's OTP must not match demo-woman's pair
  assertEquals(match.otp, '654321');
});

// ─── getClientIp ──────────────────────────────────────────────────────────────

Deno.test('getClientIp: single value', () => {
  const req = new Request('https://example.com', { headers: { 'x-forwarded-for': '1.2.3.4' } });
  assertEquals(getClientIp(req), '1.2.3.4');
});

Deno.test('getClientIp: takes the first of multiple proxy-chain values', () => {
  const req = new Request('https://example.com', { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } });
  assertEquals(getClientIp(req), '1.2.3.4');
});

Deno.test('getClientIp: missing header returns null', () => {
  const req = new Request('https://example.com');
  assertEquals(getClientIp(req), null);
});
