import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let cached: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}

export function getSupabaseConfigError(): string | null {
  if (!url || !anonKey) {
    return 'Supabase is not configured. Copy .env.example to .env, fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart.';
  }
  return null;
}

export function supabase(): SupabaseClient {
  if (cached) return cached;
  if (!url || !anonKey) {
    throw new Error('Supabase env vars missing — see .env.example');
  }
  cached = createClient(url, anonKey, {
    auth: { persistSession: false }, // we use app-level auth, not Supabase Auth
  });
  return cached;
}
