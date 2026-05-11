import { useState } from 'react';
import { motion } from 'framer-motion';
import type { InterviewBrief } from '../../lib/taskInterview';
import { TASK_KIND_OPTIONS, composeReqMd } from '../../lib/taskInterview';
import { downloadText, safeFilename } from '../../lib/files';
import type { TaskAttachment } from '../../domain/types';
import { Spinner } from '../../ui/components/Spinner';
import { CloseIcon } from '../../ui/components/Icon';
import { DownloadIcon } from '../../ui/components/IconExtras';

interface Props {
  brief: InterviewBrief;
  assigneeName: string;
  attachments: TaskAttachment[];
  onConfirm: (brief: InterviewBrief) => void;
  onCancel: () => void;
  saving: boolean;
  error?: string | null;
}

export function SummaryCard({
  brief,
  assigneeName,
  attachments,
  onConfirm,
  onCancel,
  saving,
  error,
}: Props) {
  const [draft, setDraft] = useState<InterviewBrief>(brief);

  function update<K extends keyof InterviewBrief>(key: K, value: InterviewBrief[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function updateSection(key: string, body: string) {
    setDraft((d) => ({ ...d, sections: { ...d.sections, [key]: body } }));
  }

  function removeTech(t: string) {
    setDraft((d) => ({ ...d, techStack: d.techStack.filter((x) => x !== t) }));
  }

  const diagrams = attachments.filter(
    (a) => a.kind === 'file' && a.mimeType?.startsWith('image/'),
  );
  const otherAttachments = attachments.filter(
    (a) => !(a.kind === 'file' && a.mimeType?.startsWith('image/')),
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-5 space-y-4"
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="w-1.5 h-1.5 rounded-full bg-teal shadow-teal-glow" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-teal/80">
          Task brief
        </span>
      </div>
      <p className="text-sm text-slate-400 -mt-2">
        Review and edit before assigning to{' '}
        <span className="text-slate-200 font-medium">{assigneeName}</span>.
      </p>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <Field label="Type">
          <span className="font-mono text-teal">{draft.type}</span>
        </Field>
        <Field label="Project">
          <span className="text-slate-200">{draft.projectName || '—'}</span>
        </Field>
        <Field label="Client">
          <span className="text-slate-200">{draft.clientName || '—'}</span>
        </Field>
        {draft.type === 'development' && (
          <Field label="Kind">
            <select
              className="input-base !py-1.5 !text-xs"
              value={draft.devKind ?? ''}
              onChange={(e) =>
                update('devKind', (e.target.value || null) as InterviewBrief['devKind'])
              }
              disabled={saving}
            >
              {TASK_KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      <div>
        <Label>Title</Label>
        <input
          type="text"
          className="input-base !py-2 !text-sm"
          value={draft.title}
          onChange={(e) => update('title', e.target.value)}
          disabled={saving}
        />
      </div>

      <div>
        <Label>Overview</Label>
        <textarea
          className="input-base !py-2 !text-sm min-h-[60px]"
          value={draft.shortDescription}
          onChange={(e) => update('shortDescription', e.target.value)}
          rows={3}
          disabled={saving}
        />
      </div>

      {/* Tech stack pills */}
      {draft.techStack.length > 0 && (
        <div>
          <Label>Tech stack</Label>
          <div className="flex flex-wrap gap-1.5">
            {draft.techStack.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border border-teal/30 bg-teal/10 text-teal"
              >
                {t}
                <button
                  type="button"
                  onClick={() => removeTech(t)}
                  disabled={saving}
                  className="text-teal/70 hover:text-teal"
                  aria-label={`Remove ${t}`}
                >
                  <CloseIcon size={10} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Outline sections */}
      {draft.outline && draft.outline.sections.length > 0 && (
        <div className="space-y-3">
          <Label>Sections</Label>
          {draft.outline.sections.map((s) => (
            <div key={s.key}>
              <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">
                {s.title}
              </div>
              <textarea
                className="input-base !py-1.5 !text-xs min-h-[48px]"
                value={draft.sections[s.key] ?? ''}
                onChange={(e) => updateSection(s.key, e.target.value)}
                rows={2}
                disabled={saving}
                placeholder={s.hint || ''}
              />
            </div>
          ))}
        </div>
      )}

      <div>
        <Label>Expected output</Label>
        <textarea
          className="input-base !py-2 !text-sm min-h-[60px]"
          value={draft.expectedOutput}
          onChange={(e) => update('expectedOutput', e.target.value)}
          rows={3}
          disabled={saving}
        />
      </div>

      {/* Diagrams thumbnails */}
      {diagrams.length > 0 && (
        <div>
          <Label>Diagrams ({diagrams.length})</Label>
          <div className="flex flex-wrap gap-2">
            {diagrams.map((d) => (
              <div
                key={d.id}
                className="w-20 h-20 rounded-lg overflow-hidden border border-white/10 bg-navy-950"
                title={d.name}
              >
                {d.url && (
                  <img src={d.url} alt={d.name} className="w-full h-full object-cover" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other attachments count */}
      {otherAttachments.length > 0 && (
        <div className="text-xs text-slate-400">
          {otherAttachments.length} other attachment
          {otherAttachments.length === 1 ? '' : 's'} (files / notes)
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs leading-relaxed">
          <div className="font-semibold mb-0.5">Could not assign task</div>
          <div className="font-mono break-words">{error}</div>
        </div>
      )}

      <div className="flex justify-between items-center pt-2 gap-2 flex-wrap">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-slate-400 hover:text-slate-200"
          disabled={saving}
        >
          Cancel
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const md = composeReqMd(draft, { assigneeName });
              const fname = `${safeFilename(draft.title || 'task')}.req.md`;
              downloadText(md, fname);
            }}
            disabled={saving}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border border-white/10 bg-navy-900/60 text-slate-300 hover:border-teal/40 hover:bg-teal/5 hover:text-white transition-colors disabled:opacity-50"
            title="Download brief as .req.md"
          >
            <DownloadIcon size={13} />
            Download .req.md
          </button>
          <button
            type="button"
            onClick={() => onConfirm(draft)}
            className="btn-primary"
            disabled={saving || !draft.title.trim()}
          >
            {saving ? <Spinner /> : null}
            Assign task
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      <div>{children}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">{children}</div>
  );
}
