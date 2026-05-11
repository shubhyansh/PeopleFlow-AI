import { useEffect, useState } from 'react';
import { Modal } from '../../ui/components/Modal';
import { Spinner } from '../../ui/components/Spinner';
import { toErrorMessage } from '../../lib/errors';

interface Props {
  open: boolean;
  title: string;
  description?: string;
  placeholder?: string;
  confirmLabel: string;
  /** Tailwind classes for the confirm button. Defaults to btn-primary. */
  confirmClass?: string;
  required?: boolean;
  onClose: () => void;
  onSubmit: (note: string) => Promise<void>;
}

export function NoteModal({
  open,
  title,
  description,
  placeholder,
  confirmLabel,
  confirmClass,
  required = true,
  onClose,
  onSubmit,
}: Props) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNote('');
      setError(null);
    }
  }, [open]);

  async function handleSubmit() {
    if (required && !note.trim()) {
      setError('Please add a note.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onSubmit(note);
      onClose();
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => (busy ? null : onClose())}
      title={title}
      {...(description ? { description } : {})}
    >
      <div className="space-y-4">
        <textarea
          className="input-base min-h-[100px]"
          rows={4}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={placeholder}
          disabled={busy}
          autoFocus
        />
        {error && (
          <p className="text-sm text-amber-300" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className={
              confirmClass ??
              'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 bg-teal-500 text-navy-950 font-semibold transition-all hover:bg-teal-400 hover:shadow-teal-glow active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed'
            }
          >
            {busy ? <Spinner /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
