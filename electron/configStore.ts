import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Shared helpers for reading and writing flowdesk-config.json in the user's
 * platform-specific config directory:
 *   macOS:   ~/Library/Application Support/FlowDesk/flowdesk-config.json
 *   Windows: %APPDATA%\FlowDesk\flowdesk-config.json
 *   Linux:   ~/.config/FlowDesk/flowdesk-config.json
 *
 * Both ipc/config.ts (IPC handlers) and env.ts (Groq key fallback) read
 * through this module so there's one source of truth for the file format.
 */

export function configFilePath(): string {
  return path.join(app.getPath('userData'), 'flowdesk-config.json');
}

export function readConfig(): Record<string, unknown> {
  const p = configFilePath();
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function writeConfig(data: Record<string, unknown>): void {
  fs.writeFileSync(configFilePath(), JSON.stringify(data, null, 2), 'utf-8');
}

export function getGroqKeyFromConfig(): string | null {
  const cfg = readConfig();
  const k = cfg.groqApiKey;
  return typeof k === 'string' && k.trim() ? k.trim() : null;
}
