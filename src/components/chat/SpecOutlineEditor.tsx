import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { OutlineSection, SpecOutline } from '../../lib/specOutline';
import { newId } from '../../lib/id';
import { CloseIcon, PlusIcon } from '../../ui/components/Icon';
import { DownloadIcon, PaperclipIcon } from '../../ui/components/IconExtras';
import { Spinner } from '../../ui/components/Spinner';

interface Props {
  initial: SpecOutline;
  onConfirm: (outline: SpecOutline) => void;
  /** Triggers a download of the current outline as a blank .req.md template. */
  onDownloadTemplate?: (outline: SpecOutline) => void;
  /** Triggered when user uploads a filled .req.md from this card. Parent parses + jumps to summary. */
  onUploadFilled?: (file: File) => void | Promise<void>;
}

/**
 * Editable checklist of brief sections. Admin can:
 *  - delete a suggested section
 *  - add a custom section (title + optional hint)
 *  - reorder via the drag handle (simple up/down for now)
 *
 * After confirm, the chat walks through each section asking one concise
 * question per section.
 */
export function SpecOutlineEditor({
  initial,
  onConfirm,
  onDownloadTemplate,
  onUploadFilled,
}: Props) {
  const [sections, setSections] = useState<OutlineSection[]>(initial.sections);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newHint, setNewHint] = useState('');
  const [uploadBusy, setUploadBusy] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  function remove(key: string) {
    setSections((cur) => cur.filter((s) => s.key !== key));
  }

  function move(key: string, direction: -1 | 1) {
    setSections((cur) => {
      const idx = cur.findIndex((s) => s.key === key);
      if (idx < 0) return cur;
      const target = idx + direction;
      if (target < 0 || target >= cur.length) return cur;
      const next = [...cur];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  function commitNew() {
    const t = newTitle.trim();
    if (!t) return;
    setSections((cur) => [
      ...cur,
      {
        key: newId('sec'),
        title: t,
        ...(newHint.trim() ? { hint: newHint.trim() } : {}),
      },
    ]);
    setNewTitle('');
    setNewHint('');
    setAdding(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-5 space-y-3"
    >
      <div>
        <div className="font-mono text-[10px] text-teal uppercase tracking-wider mb-1">
          Spec outline
        </div>
        <p className="text-xs text-slate-400">
          Here's the checklist I'll walk you through. Drop sections that don't apply or add your
          own. Each section gets a single concise question.
        </p>
      </div>

      <ul className="space-y-2">
        {sections.map((s, i) => (
          <li
            key={s.key}
            className="flex items-start gap-2 px-3 py-2.5 rounded-xl border border-white/10 bg-navy-950/40"
          >
            <div className="flex flex-col gap-1 mt-0.5 shrink-0">
              <button
                type="button"
                onClick={() => move(s.key, -1)}
                disabled={i === 0}
                className="text-[10px] text-slate-500 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed leading-none"
                aria-label="Move up"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => move(s.key, 1)}
                disabled={i === sections.length - 1}
                className="text-[10px] text-slate-500 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed leading-none"
                aria-label="Move down"
              >
                ▼
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{s.title}</div>
              {s.hint && (
                <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{s.hint}</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => remove(s.key)}
              className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              aria-label="Remove section"
            >
              <CloseIcon size={14} />
            </button>
          </li>
        ))}
      </ul>

      {adding ? (
        <div className="space-y-2 rounded-xl border border-teal/20 bg-teal/5 p-3">
          <input
            type="text"
            placeholder="Section title (e.g. Edge cases)"
            className="input-base !py-1.5 !text-sm"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            autoFocus
          />
          <input
            type="text"
            placeholder="Optional hint (one line)"
            className="input-base !py-1.5 !text-xs"
            value={newHint}
            onChange={(e) => setNewHint(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setNewTitle('');
                setNewHint('');
              }}
              className="text-xs text-slate-400 hover:text-slate-200 px-2"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={commitNew}
              className="btn-primary !py-1.5 !text-xs"
              disabled={!newTitle.trim()}
            >
              Add section
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border border-white/10 bg-navy-900/60 text-slate-300 hover:border-teal/40 hover:bg-teal/5 hover:text-white"
        >
          <PlusIcon size={12} />
          Add custom section
        </button>
      )}

      <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          {onDownloadTemplate && (
            <button
              type="button"
              onClick={() => onDownloadTemplate({ sections })}
              disabled={sections.length === 0 || uploadBusy}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-white/10 bg-navy-900/60 text-slate-300 hover:border-teal/40 hover:bg-teal/5 hover:text-white disabled:opacity-50"
              title="Download a blank .req.md to fill offline"
            >
              <DownloadIcon size={12} />
              Download checklist
            </button>
          )}
          {onUploadFilled && (
            <>
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                disabled={uploadBusy}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-white/10 bg-navy-900/60 text-slate-300 hover:border-teal/40 hover:bg-teal/5 hover:text-white disabled:opacity-50"
                title="Upload a filled .req.md to skip ahead"
              >
                {uploadBusy ? <Spinner size={12} /> : <PaperclipIcon size={12} />}
                Upload filled
              </button>
              <input
                ref={uploadInputRef}
                type="file"
                accept=".md,text/markdown,text/plain"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  setUploadBusy(true);
                  try {
                    await onUploadFilled(f);
                  } finally {
                    setUploadBusy(false);
                  }
                }}
              />
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => onConfirm({ sections })}
          className="btn-primary"
          disabled={sections.length === 0 || uploadBusy}
        >
          {sections.length === 0 ? 'Add at least one section' : 'Start filling'}
        </button>
      </div>
    </motion.div>
  );
}
