// Supabase client for MIEN (React Native / Expo).
//
// The session is persisted via AsyncStorage so a logged-in user resumes
// across app restarts. The URL + anon key are publishable by design: Expo
// inlines any EXPO_PUBLIC_ var into the JS bundle, so anyone unzipping the
// IPA/APK can read them. Access is guarded by RLS, not by hiding these.
// They are already committed in eas.json, so they are defaulted here too --
// one source, no per-machine .env setup. Set the env vars to point at a
// different project.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  'https://trtjcsxcowqecsebvyme.supabase.co';
const anonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRydGpjc3hjb3dxZWNzZWJ2eW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMjM0OTUsImV4cCI6MjA5NTY5OTQ5NX0.m9rLqY5nU192htXNw0vC74qGos82NDcrKf2fw2mEgOc';

export const sb = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // RN — no URL-based session
  },
});
