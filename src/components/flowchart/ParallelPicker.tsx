import { useState } from 'react';
import { Modal } from '../../ui/components/Modal';
import { Spinner } from '../../ui/components/Spinner';
import type { Task } from '../../domain/types';
import { toErrorMessage } from '../../lib/errors';

interface Props {
  open: boolean;
  active: Task | null;
  candidates: Task[];
  onClose: () => void;
  onConfirm: (otherId: string, estimatedDays: number) => Promise<void>;
}

export function ParallelPicker({ open, active, candidates, onClose, onConfirm }: Props) {
  const [otherId, setOtherId] = useState<string | null>(null);
  const [days, setDays] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!otherId) return;
    setError(null);
    setBusy(true);
    try {
      await onConfirm(otherId, days);
      onClose();
      setOtherId(null);
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
      title="Run another task in parallel"
      description={
        active
          ? `Pick a pending task to run alongside "${active.title}". Both will become parallel/active.`
          : ''
      }
      width="lg"
    >
      <div className="space-y-4">
        {candidates.length === 0 ? (
          <p className="text-sm text-slate-400">
            No pending tasks available to run in parallel.
          </p>
        ) : (
          <>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {candidates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setOtherId(t.id)}
                  className={[
                    'w-full text-left px-4 py-3 rounded-xl border transition-colors',
                    otherId === t.id
                      ? 'border-teal/50 bg-teal/10'
                      : 'border-white/10 bg-navy-900/60 hover:border-teal/30',
                  ].join(' ')}
                >
                  <div className="font-medium text-white text-sm">{t.title}</div>
                  <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                    #{t.sequenceIndex} · {new Date(t.createdAt).toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                Estimated days for the new task
              </label>
              <input
                type="number"
                min={1}
                max={365}
                className="input-base"
                value={days}
                onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
                disabled={busy}
              />
            </div>
          </>
        )}

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
            className="btn-primary"
            onClick={handleConfirm}
            disabled={busy || !otherId || candidates.length === 0}
          >
            {busy ? <Spinner /> : null}
            Run in parallel
          </button>
        </div>
      </div>
    </Modal>
  );
}
