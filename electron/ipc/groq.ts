import { ipcMain } from 'electron';
import Groq from 'groq-sdk';
import { IPC, type GroqChatRequest, type GroqChatResponse } from '../../shared/ipc-contract';
import { getGroqApiKey, getGroqModel } from '../env';

let client: Groq | null = null;

function getClient(): Groq | null {
  const key = getGroqApiKey();
  if (!key) return null;
  if (!client) client = new Groq({ apiKey: key });
  return client;
}

export function registerGroqIpc(): void {
  ipcMain.handle(
    IPC.groqChat,
    async (_event, req: GroqChatRequest): Promise<GroqChatResponse> => {
      const groq = getClient();
      const model = req.model ?? getGroqModel();

      if (!groq) {
        return {
          content:
            '[stub] GROQ_API_KEY is not set. Add it to your .env and restart to enable real AI follow-ups.',
          model,
          stub: true,
        };
      }

      try {
        const completion = await groq.chat.completions.create({
          model,
          messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
          temperature: req.temperature ?? 0.3,
          max_tokens: req.maxTokens ?? 1500,
        });
        const content = completion.choices[0]?.message?.content ?? '';
        return { content, model };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: `[error] Groq request failed: ${msg}`,
          model,
          stub: true,
        };
      }
    },
  );
}
