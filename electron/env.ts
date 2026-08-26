import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { getGroqKeyFromConfig } from './configStore';

let loaded = false;

export function loadEnv(): void {
  if (loaded) return;
  loaded = true;

  const candidates = [
    process.env.NODE_ENV === 'development' ? path.resolve(process.cwd(), '.env') : null,
    path.join(app.getPath('userData'), '.env'),
    path.join(path.dirname(app.getPath('exe')), '.env'),
  ].filter((p): p is string => Boolean(p));

  for (const file of candidates) {
    if (fs.existsSync(file)) {
      // `quiet` suppresses the banner dotenv 17 prints on every load. It is an
      // unknown option to dotenv 16, which ignores it, so this is safe to set
      // before the bump lands.
      dotenv.config({ path: file, quiet: true });
      break;
    }
  }
}

/**
 * Resolution order:
 *   1. Per-user config file (set via the in-app setup screen) — preferred
 *   2. GROQ_API_KEY from .env — dev convenience + legacy install path
 *
 * Read fresh on every call so updates from the setup screen take effect
 * without an app restart.
 */
export function getGroqApiKey(): string | null {
  const fromConfig = getGroqKeyFromConfig();
  if (fromConfig) return fromConfig;
  return process.env.GROQ_API_KEY?.trim() || null;
}

export function getGroqModel(): string {
  return process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile';
}
