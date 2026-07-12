// revenuecat-webhook — Deno Edge Function
// Sole writer of profiles.account_type. RevenueCat calls this endpoint whenever
// a subscription/entitlement changes (purchase, renewal, cancellation, refund,
// expiration). account_type flips to 'premium' ONLY on a store-verified
// purchase event (Google Play / App Store), and back to 'free' on expiration.
//
// Setup (RevenueCat dashboard → Project → Integrations → Webhooks):
//   • URL:    https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook
//   • Header: Authorization = <REVENUECAT_WEBHOOK_SECRET>   (a value you choose)
// Set the matching secret on the function:
//   supabase secrets set REVENUECAT_WEBHOOK_SECRET=<the-same-value>
//
// IMPORTANT: deploy with --no-verify-jwt. RevenueCat sends its own shared-secret
// Authorization header, not a Supabase JWT, so the platform JWT gate must be off
// and we authenticate the shared secret ourselves below.
//
// Mapping requirement: the app calls Purchases.logIn(supabaseUserId) (app/_layout.tsx)
// so event.app_user_id IS the profiles.id. Anonymous ids ($RCAnonymousID:…) and
// non-UUID ids are ignored.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Our premium entitlement identifier (matches usePremium: entitlements.active['premium']).
const PREMIUM_ENTITLEMENT = 'premium';

// Event types that GRANT access vs REVOKE it. CANCELLATION is intentionally
// absent — turning off auto-renew keeps access until EXPIRATION. BILLING_ISSUE
// is a grace period, so we also keep access until it actually expires.
const GRANT = new Set([
  'INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION',
  'NON_RENEWING_PURCHASE', 'SUBSCRIPTION_EXTENDED', 'TEMPORARY_ENTITLEMENT_GRANT',
]);
const REVOKE = new Set(['EXPIRATION', 'SUBSCRIPTION_PAUSED']);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RcEvent {
  type: string;
  app_user_id?: string;
  entitlement_ids?: string[] | null;
  entitlement_id?: string | null;
  transferred_from?: string[];
  transferred_to?: string[];
  store?: string;
  period_type?: string;
  event_timestamp_ms?: number;
  expiration_at_ms?: number | null;
}

type SetTypeResult = { status: 'updated' | 'no-match' | 'error'; message?: string };

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const isRealUser = (id: string | undefined): id is string =>
  !!id && !id.startsWith('$RCAnonymousID:') && UUID_RE.test(id);

// Constant-time shared-secret check. Comparing SHA-256 digests (fixed 32 bytes)
// instead of the raw strings hides both the secret's length and its content from
// timing analysis.
async function secretMatches(provided: string | null, expected: string): Promise<boolean> {
  if (!provided) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(provided)),
    crypto.subtle.digest('SHA-256', enc.encode(expected)),
  ]);
  const av = new Uint8Array(a), bv = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < av.length; i++) diff |= av[i] ^ bv[i];
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // 1. Authenticate the shared secret RevenueCat is configured to send.
  const expected = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (!expected) {
    console.error('[revenuecat-webhook] REVENUECAT_WEBHOOK_SECRET not set');
    return json({ error: 'Server not configured' }, 500);
  }
  if (!(await secretMatches(req.headers.get('Authorization'), expected))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // 2. Parse the event.
  let event: RcEvent;
  try {
    const payload = await req.json();
    event = payload.event as RcEvent;
    if (!event?.type) return json({ error: 'Missing event' }, 400);
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  // 3. Only react to events touching OUR premium entitlement (when specified).
  const ents = event.entitlement_ids ?? (event.entitlement_id ? [event.entitlement_id] : null);
  if (ents && !ents.includes(PREMIUM_ENTITLEMENT)) {
    console.log(`[revenuecat-webhook] ${event.type}: not premium entitlement (${ents.join(',')}), ignored`);
    return json({ ok: true, ignored: 'entitlement' }, 200);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Only ever flip between 'free' and 'premium' — never clobber 'demo'/'admin'.
  // Idempotency/out-of-order guard (audit 2026-07-03): `eventMs` (event_timestamp_ms)
  // is compared against the row's stored `rc_last_event_ms` inside the WHERE clause
  // so a delayed/retried older event can never overwrite a newer one's result —
  // e.g. an EXPIRATION that RC redelivers late, arriving after a subsequent RENEWAL,
  // must not flip the user back to free.
  async function setType(userId: string, next: 'free' | 'premium', eventMs: number | null): Promise<SetTypeResult> {
    let query = admin
      .from('profiles')
      .update(eventMs != null ? { account_type: next, rc_last_event_ms: eventMs } : { account_type: next })
      .eq('id', userId)
      .in('account_type', ['free', 'premium']);
    if (eventMs != null) {
      query = query.or(`rc_last_event_ms.is.null,rc_last_event_ms.lt.${eventMs}`);
    }
    const { data, error } = await query.select('id');
    if (error) {
      console.error(`[revenuecat-webhook] update failed for ${userId}:`, error.message);
      return { status: 'error', message: error.message };
    }
    return { status: (data?.length ?? 0) > 0 ? 'updated' : 'no-match' };
  }

  const eventMs = typeof event.event_timestamp_ms === 'number' ? event.event_timestamp_ms : null;

  // 4. TRANSFER moves entitlements between ids (e.g. account merge / device change).
  if (event.type === 'TRANSFER') {
    // Best-effort: don't grant premium to transferred_to when the event tells us
    // the underlying entitlement is already expired — a stale/replayed TRANSFER
    // for an already-lapsed subscription would otherwise grant permanent premium,
    // since no later EXPIRATION event ever targets the new (transferred_to) id.
    // RC does not guarantee `expiration_at_ms` on every TRANSFER payload; when
    // absent we fall back to the previous unconditional-grant behavior — a full
    // fix would call RC's subscriber REST API, a separate scope/cost decision
    // (flagged in backlog.md).
    const expired = typeof event.expiration_at_ms === 'number' && event.expiration_at_ms < Date.now();

    const toIds = (event.transferred_to ?? []).filter(isRealUser);
    const fromIds = (event.transferred_from ?? []).filter(isRealUser);
    const results = await Promise.all([
      ...toIds.map((id) => setType(id, expired ? 'free' : 'premium', eventMs)),
      ...fromIds.map((id) => setType(id, 'free', eventMs)),
    ]);
    const failed = results.filter((r) => r.status === 'error');
    if (failed.length > 0) {
      console.error('[revenuecat-webhook] TRANSFER had DB errors:', failed.map((f) => f.message));
      return json({ error: 'DB update failed during TRANSFER' }, 500);
    }
    console.log(`[revenuecat-webhook] TRANSFER processed (${results.length} ids, expired=${expired})`);
    return json({ ok: true, type: 'TRANSFER' }, 200);
  }

  // 5. Grant / revoke for the standard subscription lifecycle.
  const userId = event.app_user_id;
  if (!isRealUser(userId)) {
    console.log(`[revenuecat-webhook] ${event.type}: app_user_id not a real user (${userId ?? 'none'}), ignored`);
    return json({ ok: true, ignored: 'anonymous' }, 200);
  }

  let next: 'free' | 'premium' | null = null;
  if (GRANT.has(event.type)) next = 'premium';
  else if (REVOKE.has(event.type)) next = 'free';

  if (next === null) {
    console.log(`[revenuecat-webhook] ${event.type}: no-op (e.g. CANCELLATION keeps access until expiry)`);
    return json({ ok: true, type: event.type, action: 'none' }, 200);
  }

  const result = await setType(userId, next, eventMs);
  if (result.status === 'error') {
    // Return 5xx (audit 2026-07-03): RC only retries non-2xx responses. Silently
    // returning 200 on a DB failure meant a paying user could get stuck free, or
    // an expired user could keep premium forever with no retry to correct it.
    return json({ error: 'DB update failed', detail: result.message }, 500);
  }
  const changed = result.status === 'updated';
  console.log(`[revenuecat-webhook] ${event.type} → account_type=${next} for ${userId} (changed=${changed}, store=${event.store ?? '?'})`);
  return json({ ok: true, type: event.type, account_type: next, changed }, 200);
});
