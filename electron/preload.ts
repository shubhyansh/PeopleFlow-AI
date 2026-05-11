import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC,
  type FlowdeskBridge,
  type GroqChatRequest,
  type GroqChatResponse,
  type SupabaseConfig,
} from '../shared/ipc-contract';

const bridge: FlowdeskBridge = {
  groq: {
    chat: (req: GroqChatRequest): Promise<GroqChatResponse> =>
      ipcRenderer.invoke(IPC.groqChat, req),
  },
  secrets: {
    hasGroqKey: (): Promise<boolean> => ipcRenderer.invoke(IPC.secretsHasGroqKey),
  },
  config: {
    getSupabase: (): Promise<SupabaseConfig | null> =>
      ipcRenderer.invoke(IPC.configGetSupabase),
    setSupabase: (cfg: SupabaseConfig): Promise<void> =>
      ipcRenderer.invoke(IPC.configSetSupabase, cfg),
    clearSupabase: (): Promise<void> => ipcRenderer.invoke(IPC.configClearSupabase),
  },
};

contextBridge.exposeInMainWorld('flowdesk', bridge);
