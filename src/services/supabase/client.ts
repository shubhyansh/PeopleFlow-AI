import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;
let configured: { url: string; anonKey: string } | null = null;

/** Called once at boot, after fetching config from the main process. */
export function setSupabaseConfig(cfg: { url: string; anonKey: string } | null): void {
  configured = cfg;
  cachedClient = null; // force re-create with new credentials
}

export function getSupabaseConfig(): { url: string; anonKey: string } | null {
  return configured;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(configured?.url && configured?.anonKey);
}

export function getSupabaseConfigError(): string | null {
  if (!configured?.url || !configured?.anonKey) {
    return 'Supabase is not connected. Open Settings → Connect Supabase to configure.';
  }
  return null;
}

export function supabase(): SupabaseClient {
  if (cachedClient) return cachedClient;
  if (!configured?.url || !configured?.anonKey) {
    throw new Error('Supabase not configured — finish the setup screen first.');
  }
  cachedClient = createClient(configured.url, configured.anonKey, {
    auth: { persistSession: false }, // we use app-level auth, not Supabase Auth
  });
  return cachedClient;
}

/**
 * Probe the configured Supabase project. Used by SetupScreen's "Test connection"
 * button. We hit a tiny, safe endpoint: `count` on the `users` table. If the
 * schema isn't migrated yet (`users` doesn't exist), this returns a clear hint.
 */
export async function testSupabaseConnection(cfg: {
  url: string;
  anonKey: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const client = createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: false },
    });
    const { error } = await client.from('users').select('id', { count: 'exact', head: true });
    if (error) {
      const code = error.code ?? '';
      if (code === '42P01' || /relation .* does not exist/i.test(error.message)) {
        return {
          ok: false,
          reason:
            'Reachable, but the `users` table is missing. Run setup.sql in your Supabase SQL Editor.',
        };
      }
      return { ok: false, reason: error.message };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
