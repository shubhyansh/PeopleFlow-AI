import { useState } from 'react';
import { Modal } from '../../ui/components/Modal';
import { Spinner } from '../../ui/components/Spinner';
import type { Task } from '../../domain/types';
import { toErrorMessage } from '../../lib/errors';

interface Props {
  open: boolean;
  task: Task | null;
  onClose: () => void;
  onComplete: () => Promise<void>;
}

export function CompleteModal({ open, task, onClose, onComplete }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleComplete() {
    setError(null);
    setBusy(true);
    try {
      await onComplete();
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
      title="Mark as complete?"
      description={task ? `"${task.title}" will be marked done.` : ''}
    >
      <div className="space-y-3">
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
            onClick={handleComplete}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 bg-green-500/90 text-white font-semibold transition-colors hover:bg-green-500 active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            Mark complete
          </button>
        </div>
      </div>
    </Modal>
  );
}
