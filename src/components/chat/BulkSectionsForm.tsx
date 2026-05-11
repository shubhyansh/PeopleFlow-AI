import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { SpecOutline } from '../../lib/specOutline';
import { Spinner } from '../../ui/components/Spinner';
import { DownloadIcon, PaperclipIcon } from '../../ui/components/IconExtras';

interface Props {
  outline: SpecOutline;
  initial: Record<string, string>;
  /** Called when admin clicks Continue — sections is { sectionKey → body }. */
  onSubmit: (sections: Record<string, string>) => void;
  /** Triggered by the "Download current state" button. Parent composes + downloads. */
  onDownload: (sections: Record<string, string>) => void;
  /** Triggered by "Upload filled" — parent parses + replaces. */
  onUpload: (file: File) => void | Promise<void>;
}

/**
 * Renders every section of the outline as a textarea in one screen. Admin
 * can fill some / all / none, and continue. Replaces the section-by-section
 * chat loop with a single review form.
 *
 * Includes Download / Upload buttons so admins can take the checklist offline,
 * fill it in their text editor of choice, and bring it back.
 */
export function BulkSectionsForm({ outline, initial, onSubmit, onDownload, onUpload }: Props) {
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [busy, setBusy] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  // If outline changes (e.g. after upload replaces it), refresh state to the new initial.
  useEffect(() => {
    setValues(initial);
  }, [initial, outline]);

  function update(key: string, body: string) {
    setValues((cur) => ({ ...cur, [key]: body }));
  }

  async function handleFile(file: File) {
    setBusy(true);
    try {
      await onUpload(file);
    } finally {
      setBusy(false);
    }
  }

  const filledCount = Object.values(values).filter((v) => v.trim().length > 0).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-5 space-y-4"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="font-mono text-[10px] text-teal uppercase tracking-wider mb-1">
            Fill the checklist
          </div>
          <p className="text-xs text-slate-400">
            Answer the sections inline, or download the checklist, fill it offline, and upload it
            back. Anything you leave empty stays empty in the brief.
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onDownload(values)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-white/10 bg-navy-900/60 text-slate-300 hover:border-teal/40 hover:bg-teal/5 hover:text-white disabled:opacity-50"
            title="Download current state as .req.md"
          >
            <DownloadIcon size={12} />
            Download
          </button>
          <button
            type="button"
            onClick={() => uploadRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-white/10 bg-navy-900/60 text-slate-300 hover:border-teal/40 hover:bg-teal/5 hover:text-white disabled:opacity-50"
            title="Upload a filled .req.md"
          >
            {busy ? <Spinner size={12} /> : <PaperclipIcon size={12} />}
            Upload
          </button>
          <input
            ref={uploadRef}
            type="file"
            accept=".md,text/markdown,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void handleFile(f);
            }}
          />
        </div>
      </div>

      <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
        {outline.sections.map((s) => (
          <div key={s.key}>
            <div className="flex items-baseline justify-between gap-2 mb-1.5">
              <div>
                <div className="text-sm font-medium text-white">{s.title}</div>
                {s.hint && <div className="text-[10px] text-slate-500 mt-0.5">{s.hint}</div>}
              </div>
            </div>
            <textarea
              className="input-base !py-2 !text-sm min-h-[80px]"
              value={values[s.key] ?? ''}
              onChange={(e) => update(s.key, e.target.value)}
              placeholder={s.hint || 'Your answer…'}
              rows={3}
              disabled={busy}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2">
        <span className="text-xs text-slate-500">
          {filledCount} / {outline.sections.length} section{outline.sections.length === 1 ? '' : 's'} filled
        </span>
        <button
          type="button"
          onClick={() => onSubmit(values)}
          disabled={busy}
          className="btn-primary"
        >
          Continue
        </button>
      </div>
    </motion.div>
  );
}
