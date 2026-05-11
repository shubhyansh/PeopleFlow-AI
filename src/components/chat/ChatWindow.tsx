import { useEffect, useRef, type ReactNode } from 'react';
import { MessageBubble } from './MessageBubble';
import type { ChatMessage } from './types';

interface ChatWindowProps {
  messages: ChatMessage[];
  inputArea?: ReactNode;
  header?: ReactNode;
}

export function ChatWindow({ messages, inputArea, header }: ChatWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      {header && <div className="shrink-0">{header}</div>}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
        </div>
      </div>

      {inputArea && (
        <div
          className="shrink-0 border-t border-white/5 bg-navy-900/40 backdrop-blur-sm overflow-y-auto"
          style={{ maxHeight: '70vh' }}
        >
          <div className="max-w-3xl mx-auto px-6 py-4">{inputArea}</div>
        </div>
      )}
    </div>
  );
}
