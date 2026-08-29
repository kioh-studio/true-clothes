// auth — Deno Edge Function
// Single entry point for every login path (phone OTP, email OTP, demo).
// Client no longer calls sb.auth.* directly for sign-in; it hits this
// function, which itself only calls Supabase Auth's own OTP/password APIs
// and hands the resulting session back verbatim. No custom JWTs, no
// password hashing, no session storage here — Supabase Auth remains the
// only source of truth for sessions.
//
// Routes (dispatch by path suffix, following voci/supabase/functions/subscription's
// multi-route-per-function pattern):
//   POST /functions/v1/auth/send-otp    { phone?, email? }
//   POST /functions/v1/auth/verify-otp  { phone?, email?, code }
//
// Demo accounts: DEMO_WHITELIST is a `email:otp` map (comma-separated), one
// OTP per email — an email only unlocks with its OWN OTP, never another
// demo account's. This replaces the old client-side DEMO_OTP/DEMO_PASSWORD
// constants, which shipped the credential inside the public JS bundle.
//
// Convention: corsHeaders + Deno.serve + OPTIONS branch + createClient from
// esm.sh, same as supabase/functions/delete-user/index.ts.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const DEMO_PASSWORD = Deno.env.get('DEMO_PASSWORD') ?? '';
const DEMO_PHONE = Deno.env.get('DEMO_PHONE') ?? '+84000000000';

// ─── Pure helpers (exported for index_test.ts — no HTTP server needed) ──────

/**
 * Parse the `email:otp,email:otp` DEMO_WHITELIST secret into a Map.
 * Splits each pair on the FIRST ':' only (indexOf, not split) so an OTP
 * containing ':' still parses correctly. A malformed pair (no ':', empty
 * email, or empty OTP) is logged and skipped rather than failing the whole
 * function — one bad secret edit shouldn't take down every demo account.
 */
export function parseWhitelist(raw: string): Map<string, string> {
  const map = new Map<string, string>();
  const pairs = raw.split(',');
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    // Never log `pair` itself — its right-hand side IS an OTP secret, and a
    // malformed pair like ":123456" would print that secret straight into the
    // function logs. The index is enough to find the bad entry in the secret.
    const sep = pair.indexOf(':');
    if (sep === -1) {
      if (pair.trim()) console.error('[auth] DEMO_WHITELIST: malformed pair (missing ":") at index', i);
      continue;
    }
    const email = pair.slice(0, sep).trim().toLowerCase();
    const otp = pair.slice(sep + 1).trim();
    if (!email || !otp) {
      console.error('[auth] DEMO_WHITELIST: malformed pair (empty email or otp) at index', i);
      continue;
    }
    map.set(email, otp);
  }
  return map;
}

export interface DemoMatch {
  email: string;
  otp: string;
}

/**
 * Resolve a send-otp/verify-otp request to a demo account, if any.
 * Phone match only recognizes DEMO_PHONE and maps to the FIRST whitelist
 * entry (Map preserves insertion order) — same behavior as the old
 * `pendingPhone === DEMO_PHONE → DEMO_ACCOUNTS[0]` client logic. Email match
 * is case/whitespace-insensitive, same as the old `findDemoAccount`.
 */
export function resolveDemoMatch(
  whitelist: Map<string, string>,
  input: { phone?: string; email?: string },
  demoPhone: string,
): DemoMatch | undefined {
  if (input.phone && input.phone === demoPhone) {
    const first = whitelist.entries().next();
    if (first.done) return undefined;
    const [email, otp] = first.value;
    return { email, otp };
  }
  if (input.email) {
    const normalized = input.email.trim().toLowerCase();
    const otp = whitelist.get(normalized);
    if (otp !== undefined) return { email: normalized, otp };
  }
  return undefined;
}

/**
 * Real client IP from `x-forwarded-for` (may carry a proxy chain,
 * "client, proxy1, proxy2" — the client is always the first entry).
 * Forwarded to Supabase Auth via the `Sb-Forwarded-For` header so
 * verifyOtp's per-IP rate limit (360/hr, burst 30, not configurable) is
 * keyed per real user instead of collapsing every user onto this
 * function's own IP. Supabase does NOT honor X-Forwarded-For for this.
 */
export function getClientIp(req: Request): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
}

// ─── Request handling ────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// New client per request — Sb-Forwarded-For differs per request, so a
// module-scope client would leak the first caller's IP onto every request.
function buildAuthClient(req: Request) {
  const ip = getClientIp(req);
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: ip ? { 'Sb-Forwarded-For': ip } : {} },
  });
}

interface SendOtpBody {
  phone?: string;
  email?: string;
}

interface VerifyOtpBody {
  phone?: string;
  email?: string;
  code?: string;
}

async function handleSendOtp(req: Request, whitelist: Map<string, string>): Promise<Response> {
  let body: SendOtpBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }
  const phone = typeof body.phone === 'string' ? body.phone : undefined;
  const email = typeof body.email === 'string' ? body.email : undefined;
  if (!phone && !email) {
    return jsonResponse({ error: 'phone or email is required' }, 400);
  }

  const demoMatch = resolveDemoMatch(whitelist, { phone, email }, DEMO_PHONE);
  if (demoMatch) {
    // Demo accounts have no real OTP to send — the client already knows this.
    console.log('[auth] send-otp: demo account, skipping real OTP:', demoMatch.email);
    return jsonResponse({ ok: true });
  }

  const authClient = buildAuthClient(req);
  const { error } = phone
    ? await authClient.auth.signInWithOtp({ phone, options: { shouldCreateUser: true } })
    : await authClient.auth.signInWithOtp({ email: email!, options: { shouldCreateUser: true } });

  if (error) {
    console.error('[auth] send-otp failed:', error.status, error.message);
    return jsonResponse({ error: error.message }, error.status ?? 400);
  }
  return jsonResponse({ ok: true });
}

async function handleVerifyOtp(req: Request, whitelist: Map<string, string>): Promise<Response> {
  let body: VerifyOtpBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }
  const phone = typeof body.phone === 'string' ? body.phone : undefined;
  const email = typeof body.email === 'string' ? body.email : undefined;
  const code = typeof body.code === 'string' ? body.code : undefined;
  if (!code) {
    return jsonResponse({ error: 'code is required' }, 400);
  }
  if (!phone && !email) {
    return jsonResponse({ error: 'phone or email is required' }, 400);
  }

  const authClient = buildAuthClient(req);
  const demoMatch = resolveDemoMatch(whitelist, { phone, email }, DEMO_PHONE);

  if (demoMatch) {
    // Each demo email only opens with its OWN OTP — no auto-pass, no
    // cross-account bypass. This is the whole point of the whitelist map.
    if (code !== demoMatch.otp) {
      console.error('[auth] verify-otp: wrong demo OTP for', demoMatch.email);
      return jsonResponse({ error: 'Invalid demo credentials' }, 401);
    }
    const { data, error } = await authClient.auth.signInWithPassword({
      email: demoMatch.email,
      password: DEMO_PASSWORD,
    });
    if (error || !data.session) {
      console.error('[auth] verify-otp: demo password sign-in failed:', error?.status, error?.message);
      return jsonResponse({ error: error?.message ?? 'Demo sign-in failed' }, error?.status ?? 400);
    }
    console.log('[auth] verify-otp: demo sign-in ok:', demoMatch.email);
    return jsonResponse({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      isDemo: true,
    });
  }

  const { data, error } = phone
    ? await authClient.auth.verifyOtp({ phone, token: code, type: 'sms' })
    : await authClient.auth.verifyOtp({ email: email!, token: code, type: 'email' });

  if (error || !data.session) {
    console.error('[auth] verify-otp failed:', error?.status, error?.message);
    return jsonResponse({ error: error?.message ?? 'Verification failed' }, error?.status ?? 400);
  }
  console.log('[auth] verify-otp ok:', phone ? 'phone' : 'email');
  return jsonResponse({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    isDemo: false,
  });
}

async function handleRequest(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  // Re-parsed per request (two entries — not worth caching, and it picks up a
  // secret change without waiting for a cold start).
  //
  // An empty/unset/fully-malformed DEMO_WHITELIST must NOT fail the request:
  // demo is a convenience account, real users signing in with a real OTP are
  // the actual product. A bad secret edit degrades demo to "not a demo email"
  // (falls through to the real OTP path, which fails cleanly) instead of
  // taking every login in the app down with it.
  const whitelist = parseWhitelist(Deno.env.get('DEMO_WHITELIST') ?? '');
  if (whitelist.size === 0) {
    console.error('[auth] DEMO_WHITELIST is empty, unset, or fully malformed — demo sign-in disabled, real OTP unaffected');
  }

  const pathname = new URL(req.url).pathname;
  if (pathname.endsWith('/send-otp')) return handleSendOtp(req, whitelist);
  if (pathname.endsWith('/verify-otp')) return handleVerifyOtp(req, whitelist);
  return jsonResponse({ error: 'Not found' }, 404);
}

// Guarded so importing this module (e.g. from index_test.ts, indirectly)
// never binds a listener — only the actual entrypoint invocation does.
if (import.meta.main) {
  Deno.serve(handleRequest);
}
