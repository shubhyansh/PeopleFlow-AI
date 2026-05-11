import { ipc } from './ipc';
import type { GroqMessage } from '@shared/ipc-contract';

export interface GroqResult {
  content: string;
  stub: boolean;
}

export async function chatGroq(
  messages: GroqMessage[],
  opts: { temperature?: number; maxTokens?: number } = {},
): Promise<GroqResult> {
  const res = await ipc.groq.chat({ messages, ...opts });
  return { content: res.content, stub: res.stub === true };
}

/** Strict JSON probe — instructs the model to respond with a single JSON object. */
export async function chatGroqJson<T>(
  messages: GroqMessage[],
  opts: { temperature?: number; maxTokens?: number } = {},
): Promise<{ data: T | null; stub: boolean; raw: string }> {
  const sys: GroqMessage = {
    role: 'system',
    content:
      'You MUST reply with a single valid JSON object and nothing else. No prose, no code fences, no commentary.',
  };
  const res = await chatGroq([sys, ...messages], opts);
  return {
    data: parseLooseJson<T>(res.content),
    stub: res.stub,
    raw: res.content,
  };
}

function parseLooseJson<T>(s: string): T | null {
  if (!s) return null;
  // Strip ``` fences if present.
  const cleaned = s.replace(/^\s*```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Try to find the first {...} block.
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}
