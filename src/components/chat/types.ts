import type { ReactNode } from 'react';

export type ChatRole = 'assistant' | 'user';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  /** The visible text. May be empty if `embed` is provided. */
  content: string;
  /** Optional inline UI rendered below the bubble (chips, summary card, etc). */
  embed?: ReactNode;
  /** Show a subtle "thinking" indicator on this message. */
  pending?: boolean;
}
