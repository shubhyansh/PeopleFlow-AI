import { useState } from 'react';
import { Modal } from '../../ui/components/Modal';
import { Spinner } from '../../ui/components/Spinner';
import type { Task } from '../../domain/types';
import { toErrorMessage } from '../../lib/errors';

interface Props {
  open: boolean;
  task: Task | null;
  onClose: () => void;
  onAccept: (estimatedDays: number) => Promise<void>;
}

export function AcceptModal({ open, task, onClose, onAccept }: Props) {
  const [days, setDays] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    if (!task) return;
    setError(null);
    setBusy(true);
    try {
      await onAccept(days);
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
      title="Accept this task"
      description={task ? `How many days do you need to deliver "${task.title}"?` : ''}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
            Estimated days
          </label>
          <input
            type="number"
            min={1}
            max={365}
            className="input-base"
            value={days}
            onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
            disabled={busy}
            autoFocus
          />
          <p className="text-xs text-slate-500 mt-2">
            Deadline will be set to {new Date(Date.now() + days * 86400000).toLocaleDateString()}.
          </p>
        </div>

        {error && (
          <p className="text-sm text-amber-300" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={handleAccept} disabled={busy}>
            {busy ? <Spinner /> : null}
            Accept and start
          </button>
        </div>
      </div>
    </Modal>
  );
}
