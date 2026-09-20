// delete-user — Deno Edge Function (T026 / US8)
// Purges all user data from Supabase and deletes the auth account.
// All related DB rows (clothing_items, profiles, body_measurements, style_profiles)
// cascade-delete automatically via FK ON DELETE CASCADE.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 1. Verify Bearer JWT and get authenticated user
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const token = authHeader.replace('Bearer ', '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // User-scoped client to verify the token
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userId = user.id;

  // Admin client for privileged operations
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 2. Guard shared/system accounts. Demo login (OTP 000000) and any admin
  // account resolve to a small set of stable, shared uids — never let a
  // regular delete-account request destroy them.
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('account_type')
    .eq('id', userId)
    .single();
  if (profileError) {
    console.error('[delete-user] profile lookup failed', userId, profileError.message);
    return new Response(JSON.stringify({ error: 'Failed to verify account' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (profile?.account_type === 'demo' || profile?.account_type === 'admin') {
    return new Response(JSON.stringify({ error: 'This account cannot be deleted' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 2b. Also guard by email against DEMO_WHITELIST (`email:otp,...`, same secret
  // as supabase/functions/auth/index.ts). Catches the seeded showcase account
  // (demo-woman@mien.app), which is deliberately account_type='premium' so it
  // keeps premium features — the account_type check above alone doesn't cover it.
  // Only the email keys are used; the OTP values are never read/logged here.
  const whitelistRaw = Deno.env.get('DEMO_WHITELIST');
  if (whitelistRaw) {
    const demoEmails = new Set<string>();
    for (const pair of whitelistRaw.split(',')) {
      const sep = pair.indexOf(':');
      if (sep === -1) continue; // malformed pair, skip (never log — right-hand side is an OTP)
      const email = pair.slice(0, sep).trim().toLowerCase();
      if (email) demoEmails.add(email);
    }
    if (user.email && demoEmails.has(user.email.trim().toLowerCase())) {
      return new Response(JSON.stringify({ error: 'This account cannot be deleted' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } else {
    console.warn('[delete-user] DEMO_WHITELIST unset — falling back to account_type-only demo guard');
  }

  // Lists every object under `${userId}/` in a bucket, paginating past the
  // default 100-object page so accounts with >100 photos don't leave orphans.
  async function listAllPaths(bucket: string): Promise<string[]> {
    const paths: string[] = [];
    const pageSize = 100;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await adminClient.storage
        .from(bucket)
        .list(userId, { limit: pageSize, offset });
      if (error) {
        console.error(`[delete-user] storage.list(${bucket}) failed for ${userId}:`, error.message);
        break;
      }
      if (!data || data.length === 0) break;
      paths.push(...data.map((f: { name: string }) => `${userId}/${f.name}`));
      if (data.length < pageSize) break;
    }
    return paths;
  }

  try {
    // 3. Delete all Storage objects in wardrobe-photos/{userId}/ and avatars/{userId}/.
    // Storage errors are logged (not swallowed) but don't block account deletion —
    // the right-to-delete-account guarantee takes priority over best-effort cleanup.
    for (const bucket of ['wardrobe-photos', 'avatars']) {
      const paths = await listAllPaths(bucket);
      if (paths.length > 0) {
        const { error: removeError } = await adminClient.storage.from(bucket).remove(paths);
        if (removeError) {
          console.error(`[delete-user] storage.remove(${bucket}) failed for ${userId}:`, removeError.message);
        }
      }
    }

    // 4. Delete the auth user — all DB rows cascade-delete via FK
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[delete-user]', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
