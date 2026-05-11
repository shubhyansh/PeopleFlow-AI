import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Spinner } from '../../ui/components/Spinner';

interface Props {
  placeholder?: string;
  disabled?: boolean;
  busy?: boolean;
  multiline?: boolean;
  onSend: (text: string) => void;
}

export function ChatInput({ placeholder, disabled, busy, multiline = true, onSend }: Props) {
  const [text, setText] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [text]);

  useEffect(() => {
    if (!disabled) taRef.current?.focus();
  }, [disabled]);

  function send() {
    const trimmed = text.trim();
    if (!trimmed || disabled || busy) return;
    onSend(trimmed);
    setText('');
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1 relative">
        <textarea
          ref={taRef}
          rows={multiline ? 1 : 1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder ?? 'Type your reply…'}
          disabled={disabled || busy}
          className="input-base pr-3 resize-none leading-relaxed"
          style={{ minHeight: 48 }}
        />
      </div>
      <button
        type="button"
        onClick={send}
        disabled={disabled || busy || text.trim().length === 0}
        className="btn-primary !py-3 !px-4 shrink-0"
      >
        {busy ? <Spinner /> : 'Send'}
      </button>
    </div>
  );
}
