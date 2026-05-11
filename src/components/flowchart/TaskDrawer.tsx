import { AnimatePresence, motion } from 'framer-motion';
import type { Task, TaskAttachment, TimelineEntry, TimelineKind } from '../../domain/types';
import { CloseIcon } from '../../ui/components/Icon';
import {
  AlertIcon,
  CheckIcon,
  DownloadIcon,
  FileIcon,
  MessageIcon,
  NoteIcon,
  PauseIcon,
  PlayIcon,
  SparkleIcon,
} from '../../ui/components/IconExtras';
import { statusOf } from './statusStyles';
import { TASK_KIND_OPTIONS, composeReqMdFromTask } from '../../lib/taskInterview';
import { isPaused } from '../../lib/taskLifecycle';
import { downloadText, safeFilename } from '../../lib/files';

const MS_PER_DAY = 86400000;

/**
 * Drawer modes:
 *  - 'employee' — owner of the task; can accept / complete / pause / blocker / etc
 *  - 'admin' — full admin powers; can resolve blockers + add new requirements
 *  - 'observer' — read-only; "managed by admin" banner. Used in a lead's
 *    project view for tasks the admin assigned directly (lead is not responsible)
 */
export type DrawerMode = 'employee' | 'admin' | 'observer';

interface Props {
  open: boolean;
  task: Task | null;
  projectName: string;
  clientName: string;
  locked: boolean;
  mode: DrawerMode;
  /** Map of userId → display name; admin id 'admin' resolves to 'Administrator'. */
  userNames?: Map<string, string>;
  onClose: () => void;
  // Employee actions
  onAccept?: () => void;
  onComplete?: () => void;
  onMarkParallel?: () => void;
  onFlagBlocker?: () => void;
  onResolveBlocker?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onAddComment?: () => void;
  onAcknowledgeRequirements?: () => void;
  // Admin actions
  onAddRequirements?: () => void;
}

export function TaskDrawer(props: Props) {
  return (
    <AnimatePresence>
      {props.open && props.task && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-40 flex justify-end"
        >
          <motion.div
            className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={props.onClose}
          />
          <motion.aside
            initial={{ x: 30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 30, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="relative w-full max-w-lg h-full bg-navy-900 border-l border-white/10 shadow-glass flex flex-col"
          >
            <DrawerContent {...props} task={props.task!} />
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DrawerContent({
  task,
  projectName,
  clientName,
  locked,
  mode,
  userNames,
  onClose,
  onAccept,
  onComplete,
  onMarkParallel,
  onFlagBlocker,
  onResolveBlocker,
  onPause,
  onResume,
  onAddComment,
  onAcknowledgeRequirements,
  onAddRequirements,
}: Props & { task: Task }) {
  const status = statusOf(task.status);
  const devLabel = task.devKind
    ? TASK_KIND_OPTIONS.find((o) => o.value === task.devKind)?.label ?? null
    : null;
  const remaining =
    task.deadline !== undefined
      ? Math.ceil((new Date(task.deadline).getTime() - Date.now()) / MS_PER_DAY)
      : null;

  return (
    <>
      <div className="px-6 py-5 border-b border-white/5 flex items-start justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`pill ${status.pillClasses}`}>
              <span
                className="w-1.5 h-1.5 rounded-full inline-block"
                style={{ backgroundColor: status.dot }}
              />
              {status.label}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
              {task.type === 'leadership' ? 'Lead' : 'Dev'}
              {devLabel ? ` · ${devLabel}` : ''}
            </span>
            {locked && (
              <span className="font-mono text-[11px] text-slate-500">🔒 locked</span>
            )}
          </div>
          <h2 className="font-display text-xl font-semibold text-white leading-snug">
            {task.title}
          </h2>
          {(projectName || clientName) && (
            <p className="text-sm text-slate-400 mt-1.5">
              {projectName}
              {projectName && clientName ? ' · ' : ''}
              <span className="text-slate-500">{clientName}</span>
            </p>
          )}
          {task.techStack && task.techStack.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {task.techStack.map((t) => (
                <span
                  key={t}
                  className="inline-block px-2 py-0.5 rounded-md text-[10px] border border-teal/30 bg-teal/10 text-teal"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-start gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              const md = composeReqMdFromTask(task, {
                projectName,
                clientName,
                ...(userNames && task.assigneeId
                  ? { assigneeName: userNames.get(task.assigneeId) ?? task.assigneeId }
                  : {}),
              });
              downloadText(md, `${safeFilename(task.title)}.req.md`);
            }}
            className="p-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-teal transition-colors"
            aria-label="Download brief as .req.md"
            title="Download .req.md"
          >
            <DownloadIcon size={16} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-slate-200"
            aria-label="Close drawer"
          >
            <CloseIcon size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        <BriefRenderer brief={task.brief} />

        <Section title="Expected output">
          <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
            {task.expectedOutput || <span className="text-slate-500">—</span>}
          </p>
        </Section>

        {/* Diagrams (image attachments) get their own thumbnailed section. */}
        {(() => {
          const diagrams = task.attachments.filter(
            (a) => a.kind === 'file' && a.mimeType?.startsWith('image/'),
          );
          const others = task.attachments.filter(
            (a) => !(a.kind === 'file' && a.mimeType?.startsWith('image/')),
          );
          return (
            <>
              {diagrams.length > 0 && (
                <Section title={`Diagrams (${diagrams.length})`}>
                  <div className="grid grid-cols-2 gap-2">
                    {diagrams.map((d) => (
                      <a
                        key={d.id}
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-lg overflow-hidden border border-white/10 bg-navy-950 hover:border-teal/40 transition-colors"
                      >
                        {d.url ? (
                          <img
                            src={d.url}
                            alt={d.name}
                            className="w-full h-32 object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-32 flex items-center justify-center text-xs text-slate-500">
                            No preview
                          </div>
                        )}
                        {d.description && (
                          <div className="px-2 py-1 text-[10px] text-slate-400 truncate">
                            {d.description}
                          </div>
                        )}
                      </a>
                    ))}
                  </div>
                </Section>
              )}
              {others.length > 0 && (
                <Section title={`Attachments (${others.length})`}>
                  <ul className="space-y-2">
                    {others.map((a) => (
                      <AttachmentRow key={a.id} attachment={a} />
                    ))}
                  </ul>
                </Section>
              )}
            </>
          );
        })()}

        <Section title="Timing">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Assigned">{new Date(task.createdAt).toLocaleDateString()}</Field>
            <Field label="Sequence">#{task.sequenceIndex}</Field>
            <Field label="Accepted">
              {task.acceptedAt ? new Date(task.acceptedAt).toLocaleDateString() : '—'}
            </Field>
            <Field label="Estimated">
              {task.estimatedDays ? `${task.estimatedDays} days` : '—'}
            </Field>
            <Field label="Deadline">
              {task.deadline ? new Date(task.deadline).toLocaleDateString() : '—'}
            </Field>
            <Field label="Days left">
              {isPaused(task.status) ? (
                <span className="text-slate-400">Paused</span>
              ) : remaining === null ? (
                '—'
              ) : remaining < 0 ? (
                `${Math.abs(remaining)}d overdue`
              ) : (
                `${remaining}d`
              )}
            </Field>
          </div>
        </Section>

        <Section title="Timeline">
          {task.timeline.length === 0 ? (
            <p className="text-sm text-slate-500">No updates yet.</p>
          ) : (
            <ul className="space-y-2">
              {[...task.timeline].reverse().map((entry) => (
                <TimelineRow key={entry.id} entry={entry} userNames={userNames} />
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="px-6 py-4 border-t border-white/5 bg-navy-900/80 space-y-2">
        {mode === 'employee' ? (
          <EmployeeActions
            task={task}
            locked={locked}
            onAccept={onAccept}
            onComplete={onComplete}
            onMarkParallel={onMarkParallel}
            onFlagBlocker={onFlagBlocker}
            onResolveBlocker={onResolveBlocker}
            onPause={onPause}
            onResume={onResume}
            onAddComment={onAddComment}
            onAcknowledgeRequirements={onAcknowledgeRequirements}
          />
        ) : mode === 'observer' ? (
          <ObserverNotice />
        ) : (
          <AdminActions
            task={task}
            onAddRequirements={onAddRequirements}
            onResolveBlocker={onResolveBlocker}
          />
        )}
      </div>
    </>
  );
}

// ---------- Sub-components ----------

function EmployeeActions({
  task,
  locked,
  onAccept,
  onComplete,
  onMarkParallel,
  onFlagBlocker,
  onResolveBlocker,
  onPause,
  onResume,
  onAddComment,
  onAcknowledgeRequirements,
}: {
  task: Task;
  locked: boolean;
  onAccept?: () => void;
  onComplete?: () => void;
  onMarkParallel?: () => void;
  onFlagBlocker?: () => void;
  onResolveBlocker?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onAddComment?: () => void;
  onAcknowledgeRequirements?: () => void;
}) {
  if (locked) {
    return (
      <p className="text-xs text-slate-500 text-center">
        🔒 Locked — finish or run an earlier task in parallel to unlock.
      </p>
    );
  }
  if (task.status === 'pending') {
    return (
      <button type="button" className="btn-primary w-full" onClick={onAccept}>
        Accept and start
      </button>
    );
  }
  if (task.status === 'completed') {
    return (
      <p className="text-sm text-green-400 text-center">
        ✓ Completed{' '}
        {task.completedAt ? new Date(task.completedAt).toLocaleDateString() : ''}
      </p>
    );
  }
  if (task.status === 'blocked') {
    return (
      <div className="flex flex-col gap-2">
        <button type="button" className="btn-primary w-full" onClick={onResolveBlocker}>
          Resolve blocker
        </button>
        <button
          type="button"
          className="btn-ghost w-full text-xs"
          onClick={onAddComment}
        >
          Add a status note
        </button>
      </div>
    );
  }
  if (task.status === 'on-hold') {
    return (
      <div className="flex flex-col gap-2">
        <button type="button" className="btn-primary w-full" onClick={onResume}>
          <PlayIcon size={14} />
          Resume
        </button>
        <button type="button" className="btn-ghost w-full text-xs" onClick={onAddComment}>
          Add a status note
        </button>
      </div>
    );
  }
  if (task.status === 'requirements-addition') {
    return (
      <div className="flex flex-col gap-2">
        <button type="button" className="btn-primary w-full" onClick={onAcknowledgeRequirements}>
          <CheckIcon size={14} />
          Acknowledge new requirements
        </button>
        <button type="button" className="btn-ghost w-full text-xs" onClick={onAddComment}>
          Add a status note
        </button>
      </div>
    );
  }
  // active or parallel
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button type="button" className="btn-ghost flex-1" onClick={onMarkParallel}>
          Run in parallel
        </button>
        <button
          type="button"
          onClick={onComplete}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 bg-green-500/90 text-white font-semibold transition-colors hover:bg-green-500 active:scale-[0.98]"
        >
          <CheckIcon size={14} />
          Mark complete
        </button>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onFlagBlocker}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs border border-red-400/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors"
        >
          <AlertIcon size={13} />
          Flag blocker
        </button>
        <button
          type="button"
          onClick={onPause}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs border border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200 transition-colors"
        >
          <PauseIcon size={13} />
          Pause
        </button>
        <button
          type="button"
          onClick={onAddComment}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs border border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200 transition-colors"
        >
          <MessageIcon size={13} />
          Add note
        </button>
      </div>
    </div>
  );
}

function ObserverNotice() {
  return (
    <div className="px-3 py-2.5 rounded-xl border border-purple-400/30 bg-purple-500/10 text-purple-300 text-xs leading-relaxed text-center">
      This task was assigned directly by the admin — they're responsible for
      blockers and requirement changes. You can see it here for context but
      can't act on it from this view.
    </div>
  );
}

function AdminActions({
  task,
  onAddRequirements,
  onResolveBlocker,
}: {
  task: Task;
  onAddRequirements?: () => void;
  onResolveBlocker?: () => void;
}) {
  if (task.status === 'completed') {
    return (
      <p className="text-sm text-green-400 text-center">
        ✓ Completed{' '}
        {task.completedAt ? new Date(task.completedAt).toLocaleDateString() : ''}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {task.status === 'blocked' && (
        <button type="button" className="btn-primary w-full" onClick={onResolveBlocker}>
          Resolve blocker
        </button>
      )}
      <button
        type="button"
        onClick={onAddRequirements}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 border border-purple-400/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 transition-colors"
      >
        <SparkleIcon size={14} />
        Add new requirements
      </button>
    </div>
  );
}

/**
 * Renders a markdown-formatted brief — splits on `^## ` headers and renders
 * each section with a teal section title above its body. Falls back to a
 * single "Brief" block if no headers are present (legacy / pre-outline tasks).
 */
function BriefRenderer({ brief }: { brief: string }) {
  if (!brief.trim()) {
    return (
      <Section title="Brief">
        <span className="text-slate-500 text-sm">—</span>
      </Section>
    );
  }
  const sections = parseMarkdownSections(brief);
  if (sections.length === 0) {
    return (
      <Section title="Brief">
        <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{brief}</p>
      </Section>
    );
  }
  return (
    <>
      {sections.map((s, i) => (
        <Section key={i} title={s.title}>
          <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
            {s.body || <span className="text-slate-500">—</span>}
          </div>
        </Section>
      ))}
    </>
  );
}

function parseMarkdownSections(md: string): { title: string; body: string }[] {
  const lines = md.split('\n');
  const out: { title: string; body: string[] }[] = [];
  for (const line of lines) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m) {
      out.push({ title: m[1], body: [] });
    } else if (out.length > 0) {
      out[out.length - 1].body.push(line);
    }
  }
  return out.map((s) => ({ title: s.title, body: s.body.join('\n').trim() }));
}

function AttachmentRow({ attachment }: { attachment: TaskAttachment }) {
  if (attachment.kind === 'file') {
    return (
      <li className="rounded-xl border border-white/10 bg-navy-950/60 p-3">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 text-teal">
            <FileIcon size={16} />
          </span>
          <div className="flex-1 min-w-0">
            <a
              href={attachment.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-white hover:text-teal underline-offset-2 hover:underline truncate inline-flex items-center gap-1.5"
            >
              {attachment.name}
              <DownloadIcon size={12} />
            </a>
            {attachment.description && (
              <p className="text-xs text-slate-400 mt-1">{attachment.description}</p>
            )}
            {attachment.size != null && (
              <p className="text-[11px] font-mono text-slate-500 mt-1">
                {humanSize(attachment.size)} · {attachment.mimeType}
              </p>
            )}
          </div>
        </div>
      </li>
    );
  }
  return (
    <li className="rounded-xl border border-white/10 bg-navy-950/60 p-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-teal">
          <NoteIcon size={16} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-white">{attachment.name}</div>
          {attachment.description && (
            <p className="text-xs text-slate-400 mt-1">{attachment.description}</p>
          )}
          {attachment.body && (
            <p className="text-xs text-slate-300 mt-2 whitespace-pre-wrap break-words font-mono bg-navy-900/60 rounded-md px-2 py-1.5">
              {attachment.body}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

const KIND_LABELS: Record<TimelineKind, string> = {
  'status-change': 'Status changed',
  blocker: 'Blocker',
  'blocker-resolved': 'Blocker resolved',
  comment: 'Note',
  'requirement-edit': 'Requirements added',
  accepted: 'Accepted',
  completed: 'Completed',
};

function TimelineRow({
  entry,
  userNames,
}: {
  entry: TimelineEntry;
  userNames?: Map<string, string>;
}) {
  const author =
    entry.byUserId === 'admin'
      ? 'Administrator'
      : userNames?.get(entry.byUserId) ?? entry.byUserId;
  return (
    <li className="text-xs text-slate-300 px-3 py-2 rounded-lg border border-white/5 bg-navy-950/60">
      <div className="flex items-center justify-between text-slate-500 mb-0.5">
        <span className="font-mono uppercase tracking-wider">{KIND_LABELS[entry.kind]}</span>
        <span>{new Date(entry.at).toLocaleString()}</span>
      </div>
      {entry.note && (
        <div className="text-slate-200 whitespace-pre-wrap mt-1">{entry.note}</div>
      )}
      {entry.payload != null && (
        <details className="mt-1 text-[10px] text-slate-500">
          <summary className="cursor-pointer">{author}</summary>
          <pre className="mt-1 overflow-x-auto">{JSON.stringify(entry.payload, null, 2)}</pre>
        </details>
      )}
      {entry.payload == null && (
        <div className="text-[10px] text-slate-500 mt-1">{author}</div>
      )}
    </li>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-mono text-[10px] uppercase tracking-wider text-teal/80 mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{label}</div>
      <div className="text-slate-200">{children}</div>
    </div>
  );
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
