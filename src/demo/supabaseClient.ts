/**
 * Demo replacement for `src/services/supabase/client.ts`.
 *
 * The demo Vite build swaps this module in at resolve time (see the
 * `flowdesk-demo-backend` plugin in vite.config.ts). Everything above the
 * transport -- `services/supabase/{users,clients,projects,tasks,storage}.ts`,
 * `auth/flowdeskAuth.ts`, every route -- is the shipping code, unmodified.
 *
 * Importing this module also installs the demo IPC bridge, because in the
 * browser there is no Electron preload to provide one. `main.tsx` imports
 * this module statically and only calls `ipc` inside an effect, so the bridge
 * is always in place before the first call.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { FlowdeskBridge } from '@shared/ipc-contract';
import { MemoryDb } from './memoryDb';
import { seed } from './seed';
import { scriptedGroqChat } from './groqScript';

const DEMO_CONFIG = { url: 'https://demo.flowdesk.local', anonKey: 'demo-anon-key' };

const db = new MemoryDb(seed);

/* ------------------------------------------------------------ IPC bridge */

const demoBridge: FlowdeskBridge = {
  groq: {
    chat: async (req) => scriptedGroqChat(req),
  },
  secrets: {
    // The interview's clarifier step is one of the things worth showing, and
    // it is skipped when no key is reported.
    hasGroqKey: async () => true,
  },
  config: {
    getSupabase: async () => DEMO_CONFIG,
    setSupabase: async () => undefined,
    clearSupabase: async () => undefined,
    setGroq: async () => undefined,
  },
};

if (typeof window !== 'undefined') {
  window.flowdesk = demoBridge;
}

/* --------------------------------------------- client.ts's public surface */

export function setSupabaseConfig(_cfg: { url: string; anonKey: string } | null): void {
  // The demo store is fixed; there is nothing to point somewhere else.
}

export function getSupabaseConfig(): { url: string; anonKey: string } | null {
  return DEMO_CONFIG;
}

export function isSupabaseConfigured(): boolean {
  return true;
}

export function getSupabaseConfigError(): string | null {
  return null;
}

export function supabase(): SupabaseClient {
  return db as unknown as SupabaseClient;
}

export async function testSupabaseConnection(_cfg: {
  url: string;
  anonKey: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  return { ok: true };
}

/** Exposed for tests and for the demo reset control. */
export function demoDb(): MemoryDb {
  return db;
}
