export const IPC = {
  groqChat: 'groq:chat',
  secretsHasGroqKey: 'secrets:hasGroqKey',
  configGetSupabase: 'config:getSupabase',
  configSetSupabase: 'config:setSupabase',
  configClearSupabase: 'config:clearSupabase',
} as const;

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

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
  config: {
    getSupabase: () => Promise<SupabaseConfig | null>;
    setSupabase: (cfg: SupabaseConfig) => Promise<void>;
    clearSupabase: () => Promise<void>;
  };
}

declare global {
  interface Window {
    flowdesk: FlowdeskBridge;
  }
}
