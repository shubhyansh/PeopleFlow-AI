import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Project, User } from '../../domain/types';
import {
  addProjectMember,
  removeProjectMember,
  setProjectLead,
} from '../../services/supabase/projects';
import { listUsers } from '../../services/supabase/users';
import { toErrorMessage } from '../../lib/errors';
import { Spinner } from '../../ui/components/Spinner';
import { ChevronLeftIcon, CloseIcon, PlusIcon } from '../../ui/components/Icon';
import { SparkleIcon } from '../../ui/components/IconExtras';

interface Props {
  project: Project;
  /** 'admin' lets the panel transfer leadership; 'lead' restricts to roster edits. */
  mode: 'admin' | 'lead';
  /** Called after any mutation so the parent can refresh its data. */
  onChanged: () => void | Promise<void>;
  /** Initial open state — parents typically default to false on mount. */
  defaultOpen?: boolean;
}

export function ProjectSettings({ project, mode, onChanged, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); // tracks the in-flight action key
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingUsers(true);
    listUsers()
      .then((u) => {
        if (!cancelled) setUsers(u);
      })
      .catch((e) => {
        if (!cancelled) setError(toErrorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoadingUsers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const lead = project.leadId ? userById.get(project.leadId) ?? null : null;
  const memberRows = project.memberIds
    .map((id) => userById.get(id))
    .filter((u): u is User => Boolean(u));

  const candidatesForAdd = users.filter((u) => !project.memberIds.includes(u.id));
  const candidatesForLead = memberRows.filter((u) => u.id !== project.leadId);

  async function run<T>(key: string, fn: () => Promise<T>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await onChanged();
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="glass-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <motion.span
            animate={{ rotate: open ? -90 : 0 }}
            transition={{ duration: 0.2 }}
            className="inline-flex text-slate-500"
          >
            <ChevronLeftIcon size={14} />
          </motion.span>
          <div className="text-left">
            <div className="font-display text-sm font-semibold text-white">Project settings</div>
            <div className="font-mono text-[10px] text-slate-500 uppercase tracking-wider">
              {memberRows.length} member{memberRows.length === 1 ? '' : 's'}
              {lead ? ` · lead: ${lead.name}` : ' · no lead'}
            </div>
          </div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden border-t border-white/5"
          >
            <div className="p-5 space-y-4">
              {loadingUsers ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Spinner size={14} /> Loading members…
                </div>
              ) : (
                <>
                  {/* Members list */}
                  <div className="space-y-2">
                    {memberRows.length === 0 ? (
                      <p className="text-sm text-slate-500">No team yet.</p>
                    ) : (
                      memberRows.map((m) => {
                        const isLead = m.id === project.leadId;
                        const removeKey = `remove:${m.id}`;
                        return (
                          <div
                            key={m.id}
                            className={[
                              'flex items-center gap-3 px-3 py-2 rounded-xl border',
                              isLead
                                ? 'border-teal/30 bg-teal/5'
                                : 'border-white/10 bg-navy-950/40',
                            ].join(' ')}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-white truncate flex items-center gap-2">
                                {m.name}
                                {isLead && (
                                  <span className="pill border border-teal/30 bg-teal/10 text-teal !text-[10px]">
                                    <SparkleIcon size={10} /> Lead
                                  </span>
                                )}
                              </div>
                              <div className="font-mono text-[11px] text-slate-500 truncate">
                                @{m.username}
                                {m.designation ? ` · ${m.designation}` : ''}
                              </div>
                            </div>
                            {!isLead && (
                              <button
                                type="button"
                                onClick={() =>
                                  run(removeKey, () => removeProjectMember(project.id, m.id))
                                }
                                disabled={busy !== null}
                                className="p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                                aria-label={`Remove ${m.name}`}
                                title="Remove from team"
                              >
                                {busy === removeKey ? <Spinner size={12} /> : <CloseIcon size={14} />}
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Action row */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setPickerOpen((v) => !v);
                        setTransferOpen(false);
                      }}
                      disabled={busy !== null || candidatesForAdd.length === 0}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border border-white/10 bg-navy-900/60 text-slate-300 hover:border-teal/40 hover:bg-teal/5 hover:text-white disabled:opacity-50 disabled:hover:border-white/10 disabled:hover:bg-navy-900/60"
                    >
                      <PlusIcon size={12} />
                      Add member
                    </button>
                    {mode === 'admin' && (
                      <button
                        type="button"
                        onClick={() => {
                          setTransferOpen((v) => !v);
                          setPickerOpen(false);
                        }}
                        disabled={busy !== null || candidatesForLead.length === 0}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border border-purple-400/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 disabled:opacity-50"
                      >
                        <SparkleIcon size={12} />
                        Transfer leadership
                      </button>
                    )}
                  </div>

                  {/* Add member picker */}
                  {pickerOpen && (
                    <Picker
                      label="Pick someone to add to the team"
                      options={candidatesForAdd}
                      busyKey={busy}
                      onPick={async (u) => {
                        await run(`add:${u.id}`, () => addProjectMember(project.id, u.id));
                        setPickerOpen(false);
                      }}
                      onCancel={() => setPickerOpen(false)}
                    />
                  )}

                  {/* Lead transfer picker (admin only) */}
                  {transferOpen && mode === 'admin' && (
                    <Picker
                      label="Pick a new lead from the team"
                      options={candidatesForLead}
                      busyKey={busy}
                      onPick={async (u) => {
                        await run(`lead:${u.id}`, () => setProjectLead(project.id, u.id));
                        setTransferOpen(false);
                      }}
                      onCancel={() => setTransferOpen(false)}
                    />
                  )}

                  {error && (
                    <p className="text-sm text-amber-300" role="alert">
                      {error}
                    </p>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Picker({
  label,
  options,
  busyKey,
  onPick,
  onCancel,
}: {
  label: string;
  options: User[];
  busyKey: string | null;
  onPick: (u: User) => void | Promise<void>;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div ref={ref} className="rounded-xl border border-teal/20 bg-teal/5 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-teal/80">{label}</span>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-slate-400 hover:text-slate-200"
        >
          Cancel
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto">
        {options.map((u) => {
          const inFlight = busyKey?.endsWith(`:${u.id}`) ?? false;
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => void onPick(u)}
              disabled={busyKey !== null}
              className="text-left px-3 py-2 rounded-lg border border-white/10 bg-navy-900/60 text-sm text-slate-200 hover:border-teal/40 hover:bg-teal/10 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-2">
                {inFlight && <Spinner size={12} />}
                <span className="font-medium truncate">{u.name}</span>
              </div>
              <div className="font-mono text-[10px] text-slate-500 truncate">@{u.username}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
