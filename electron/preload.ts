import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC,
  type FlowdeskBridge,
  type GroqChatRequest,
  type GroqChatResponse,
} from '../shared/ipc-contract';

const bridge: FlowdeskBridge = {
  groq: {
    chat: (req: GroqChatRequest): Promise<GroqChatResponse> =>
      ipcRenderer.invoke(IPC.groqChat, req),
  },
  secrets: {
    hasGroqKey: (): Promise<boolean> => ipcRenderer.invoke(IPC.secretsHasGroqKey),
  },
};

contextBridge.exposeInMainWorld('flowdesk', bridge);
