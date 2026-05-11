import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-contract';
import { getGroqApiKey } from '../env';

export function registerSecretsIpc(): void {
  ipcMain.handle(IPC.secretsHasGroqKey, async (): Promise<boolean> => {
    return Boolean(getGroqApiKey());
  });
}
