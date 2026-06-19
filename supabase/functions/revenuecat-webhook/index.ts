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
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const isRealUser = (id: string | undefined): id is string =>
  !!id && !id.startsWith('$RCAnonymousID:') && UUID_RE.test(id);

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // 1. Authenticate the shared secret RevenueCat is configured to send.
  const expected = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (!expected) {
    console.error('[revenuecat-webhook] REVENUECAT_WEBHOOK_SECRET not set');
    return json({ error: 'Server not configured' }, 500);
  }
  if (req.headers.get('Authorization') !== expected) {
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
  async function setType(userId: string, next: 'free' | 'premium'): Promise<boolean> {
    const { data, error } = await admin
      .from('profiles')
      .update({ account_type: next })
      .eq('id', userId)
      .in('account_type', ['free', 'premium'])
      .select('id');
    if (error) { console.error(`[revenuecat-webhook] update failed for ${userId}:`, error.message); return false; }
    return (data?.length ?? 0) > 0;
  }

  // 4. TRANSFER moves entitlements between ids (e.g. account merge / device change).
  if (event.type === 'TRANSFER') {
    const updates: Promise<boolean>[] = [];
    for (const id of event.transferred_to ?? []) if (isRealUser(id)) updates.push(setType(id, 'premium'));
    for (const id of event.transferred_from ?? []) if (isRealUser(id)) updates.push(setType(id, 'free'));
    await Promise.all(updates);
    console.log(`[revenuecat-webhook] TRANSFER processed (${updates.length} ids)`);
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

  const changed = await setType(userId, next);
  console.log(`[revenuecat-webhook] ${event.type} → account_type=${next} for ${userId} (changed=${changed}, store=${event.store ?? '?'})`);
  return json({ ok: true, type: event.type, account_type: next, changed }, 200);
});
