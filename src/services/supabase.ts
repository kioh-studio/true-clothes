// Supabase client for MIEN (React Native / Expo).
//
// The session is persisted via AsyncStorage so a logged-in user resumes
// across app restarts. The project URL + anon (publishable) key MUST come
// from environment — never commit them. Expo inlines any var prefixed with
// EXPO_PUBLIC_ at build time, so `.env` is enough.
//
// Required env (see .env.example):
//   EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
//   EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable_key>
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url     = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Throw at module load so misconfiguration is caught immediately
  // instead of surfacing as cryptic 401s on the first request.
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
    'Set them in .env (see .env.example).'
  );
}

export const sb = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // RN — no URL-based session
  },
});
