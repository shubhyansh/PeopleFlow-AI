import type { FlowdeskBridge, GroqChatRequest, GroqChatResponse } from '@shared/ipc-contract';

function bridge(): FlowdeskBridge {
  if (typeof window === 'undefined' || !window.flowdesk) {
    // Most likely cause: preload script didn't load. In dev, check the
    // Electron terminal for a "Unable to load preload script" error.
    throw new Error(
      'FlowDesk IPC bridge not available. Restart the dev server (the preload script may not have rebuilt).',
    );
  }
  return window.flowdesk;
}

export const ipc = {
  groq: {
    chat: (req: GroqChatRequest): Promise<GroqChatResponse> => bridge().groq.chat(req),
  },
  secrets: {
    hasGroqKey: (): Promise<boolean> => bridge().secrets.hasGroqKey(),
  },
};
