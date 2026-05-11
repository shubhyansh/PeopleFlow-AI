import { useEffect, useState } from 'react';
import { Modal } from '../../ui/components/Modal';
import { Spinner } from '../../ui/components/Spinner';
import type { Task } from '../../domain/types';
import { toErrorMessage } from '../../lib/errors';

interface Props {
  open: boolean;
  task: Task | null;
  onClose: () => void;
  onAcknowledge: (extraDays: number, note: string) => Promise<void>;
}

const MS_PER_DAY = 86400000;

export function AckRequirementsModal({ open, task, onClose, onAcknowledge }: Props) {
  const [extraDays, setExtraDays] = useState(0);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setExtraDays(0);
      setNote('');
      setError(null);
    }
  }, [open]);

  const projectedDeadline =
    task?.deadline && extraDays > 0
      ? new Date(new Date(task.deadline).getTime() + extraDays * MS_PER_DAY)
      : task?.deadline
      ? new Date(task.deadline)
      : null;

  async function handleSubmit() {
    setError(null);
    setBusy(true);
    try {
      await onAcknowledge(extraDays, note);
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
      title="Acknowledge new requirements"
      description={
        task ? `Read the new scope on "${task.title}" and let the admin know if you need more time.` : ''
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
            Extra days needed (optional)
          </label>
          <input
            type="number"
            min={0}
            max={365}
            value={extraDays}
            onChange={(e) => setExtraDays(Math.max(0, Number(e.target.value) || 0))}
            className="input-base"
            disabled={busy}
            autoFocus
          />
          <p className="text-xs text-slate-500 mt-2">
            {extraDays === 0
              ? 'Deadline stays the same.'
              : projectedDeadline
              ? `New deadline: ${projectedDeadline.toLocaleDateString()} (+${extraDays} day${extraDays === 1 ? '' : 's'}).`
              : `Deadline will extend by ${extraDays} day${extraDays === 1 ? '' : 's'}.`}
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
            Reason / notes (optional)
          </label>
          <textarea
            className="input-base min-h-[80px]"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why the extra time, or anything to flag…"
            disabled={busy}
          />
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
          <button type="button" onClick={handleSubmit} className="btn-primary" disabled={busy}>
            {busy ? <Spinner /> : null}
            Acknowledge
          </button>
        </div>
      </div>
    </Modal>
  );
}
