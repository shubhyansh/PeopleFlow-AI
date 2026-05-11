import { ipcMain } from 'electron';
import { IPC, type SupabaseConfig } from '../../shared/ipc-contract';
import { readConfig, writeConfig } from '../configStore';

export function registerConfigIpc(): void {
  ipcMain.handle(IPC.configGetSupabase, async (): Promise<SupabaseConfig | null> => {
    const cfg = readConfig();
    const sb = cfg.supabase as Partial<SupabaseConfig> | undefined;
    if (sb?.url && sb?.anonKey) return { url: sb.url, anonKey: sb.anonKey };
    return null;
  });

  ipcMain.handle(IPC.configSetSupabase, async (_e, sb: SupabaseConfig): Promise<void> => {
    if (!sb?.url || !sb?.anonKey) throw new Error('Both url and anonKey are required.');
    const cfg = readConfig();
    cfg.supabase = { url: sb.url.trim(), anonKey: sb.anonKey.trim() };
    writeConfig(cfg);
  });

  ipcMain.handle(IPC.configClearSupabase, async (): Promise<void> => {
    const cfg = readConfig();
    delete cfg.supabase;
    writeConfig(cfg);
  });

  ipcMain.handle(IPC.configSetGroq, async (_e, key: string): Promise<void> => {
    if (typeof key !== 'string' || !key.trim()) {
      throw new Error('Groq API key cannot be empty.');
    }
    const cfg = readConfig();
    cfg.groqApiKey = key.trim();
    writeConfig(cfg);
  });
}
