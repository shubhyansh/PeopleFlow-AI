import { ipcMain, app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { IPC, type SupabaseConfig } from '../../shared/ipc-contract';

function configFile(): string {
  return path.join(app.getPath('userData'), 'flowdesk-config.json');
}

function readAll(): Record<string, unknown> {
  const p = configFile();
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, unknown>): void {
  fs.writeFileSync(configFile(), JSON.stringify(data, null, 2), 'utf-8');
}

export function registerConfigIpc(): void {
  ipcMain.handle(IPC.configGetSupabase, async (): Promise<SupabaseConfig | null> => {
    const cfg = readAll();
    const sb = cfg.supabase as Partial<SupabaseConfig> | undefined;
    if (sb?.url && sb?.anonKey) return { url: sb.url, anonKey: sb.anonKey };
    return null;
  });

  ipcMain.handle(IPC.configSetSupabase, async (_e, sb: SupabaseConfig): Promise<void> => {
    if (!sb?.url || !sb?.anonKey) throw new Error('Both url and anonKey are required.');
    const cfg = readAll();
    cfg.supabase = { url: sb.url.trim(), anonKey: sb.anonKey.trim() };
    writeAll(cfg);
  });

  ipcMain.handle(IPC.configClearSupabase, async (): Promise<void> => {
    const cfg = readAll();
    delete cfg.supabase;
    writeAll(cfg);
  });
}
