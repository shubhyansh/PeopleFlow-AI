export const IPC = {
  groqChat: 'groq:chat',
  secretsHasGroqKey: 'secrets:hasGroqKey',
} as const;

export type GroqRole = 'system' | 'user' | 'assistant';

export interface GroqMessage {
  role: GroqRole;
  content: string;
}

export interface GroqChatRequest {
  messages: GroqMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GroqChatResponse {
  content: string;
  model: string;
  stub?: boolean;
}

export interface FlowdeskBridge {
  groq: {
    chat: (req: GroqChatRequest) => Promise<GroqChatResponse>;
  };
  secrets: {
    hasGroqKey: () => Promise<boolean>;
  };
}

declare global {
  interface Window {
    flowdesk: FlowdeskBridge;
  }
}
