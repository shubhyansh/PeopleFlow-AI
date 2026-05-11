import { motion } from 'framer-motion';
import type { ChatMessage } from './types';

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isAssistant = message.role === 'assistant';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className={`flex ${isAssistant ? 'justify-start' : 'justify-end'} mb-4`}
    >
      <div className={`max-w-[80%] flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}>
        {isAssistant && (
          <div className="flex items-center gap-1.5 mb-1.5 px-1">
            <div className="w-1.5 h-1.5 rounded-full bg-teal shadow-teal-glow" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-teal/80">
              FlowDesk AI
            </span>
          </div>
        )}

        <div
          className={[
            'rounded-2xl px-4 py-3 text-sm leading-relaxed',
            isAssistant
              ? 'glass-card rounded-tl-sm text-slate-100'
              : 'bg-teal/10 border border-teal/20 rounded-tr-sm text-slate-100',
          ].join(' ')}
        >
          {message.content && (
            <p className="whitespace-pre-wrap">
              {message.content}
              {message.pending && <ThinkingDots />}
            </p>
          )}
          {!message.content && message.pending && <ThinkingDots />}
        </div>

        {message.embed && <div className="mt-2 w-full">{message.embed}</div>}
      </div>
    </motion.div>
  );
}

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1 ml-1 align-middle">
      <Dot delay={0} />
      <Dot delay={0.15} />
      <Dot delay={0.3} />
    </span>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <motion.span
      className="inline-block w-1 h-1 rounded-full bg-teal"
      animate={{ opacity: [0.2, 1, 0.2] }}
      transition={{ duration: 1.1, repeat: Infinity, delay, ease: 'easeInOut' }}
    />
  );
}
