import { useState, type FormEvent } from 'react';
import { Spinner } from '../../ui/components/Spinner';
import { toErrorMessage } from '../../lib/errors';

interface Props {
  label: string;
  placeholder?: string;
  onCreate: (name: string) => Promise<void>;
  onCancel: () => void;
}

export function InlineCreate({ label, placeholder, onCreate, onCancel }: Props) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      await onCreate(trimmed);
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card p-4 space-y-3">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <input
        type="text"
        className="input-base !py-2 !text-sm"
        placeholder={placeholder}
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        disabled={busy}
        required
      />
      {error && (
        <p className="text-xs text-amber-300" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="text-sm text-slate-400 hover:text-slate-200"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>
        <button type="submit" className="btn-primary !py-2 !text-sm" disabled={busy}>
          {busy ? <Spinner /> : null}
          Create
        </button>
      </div>
    </form>
  );
}
