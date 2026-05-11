import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Modal } from '../../ui/components/Modal';
import { Spinner } from '../../ui/components/Spinner';
import { uploadAttachment } from '../../services/supabase/storage';
import { newId } from '../../lib/id';
import type { Task, TaskAttachment } from '../../domain/types';
import { toErrorMessage } from '../../lib/errors';
import { CloseIcon, PlusIcon } from '../../ui/components/Icon';
import { FileIcon, LinkIcon, NoteIcon } from '../../ui/components/IconExtras';

interface Props {
  open: boolean;
  task: Task | null;
  onClose: () => void;
  onResolve: (resolution: string, attachments: TaskAttachment[]) => Promise<void>;
}

type Mode = 'idle' | 'note';

export function ResolveBlockerModal({ open, task, onClose, onResolve }: Props) {
  const [resolution, setResolution] = useState('');
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [mode, setMode] = useState<Mode>('idle');
  const [noteName, setNoteName] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setResolution('');
      setAttachments([]);
      setMode('idle');
      setNoteName('');
      setNoteBody('');
      setError(null);
    }
  }, [open]);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadAttachment(file);
      setAttachments((cur) => [
        ...cur,
        {
          id: newId('att'),
          kind: 'file',
          name: uploaded.name,
          description: '',
          url: uploaded.url,
          storagePath: uploaded.storagePath,
          mimeType: uploaded.mimeType,
          size: uploaded.size,
        },
      ]);
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  function addNote() {
    const body = noteBody.trim();
    if (!body) {
      setError('Note body is required.');
      return;
    }
    setAttachments((cur) => [
      ...cur,
      {
        id: newId('att'),
        kind: 'note',
        name: noteName.trim() || 'Note',
        description: '',
        body,
      },
    ]);
    setNoteName('');
    setNoteBody('');
    setMode('idle');
    setError(null);
  }

  function remove(id: string) {
    setAttachments((cur) => cur.filter((a) => a.id !== id));
  }

  async function handleSubmit() {
    if (!resolution.trim()) {
      setError('Resolution note is required.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onResolve(resolution.trim(), attachments);
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
      title="Resolve blocker"
      description={
        task
          ? `How was "${task.title}" unblocked? The task will resume and the deadline will extend by however long it was paused.`
          : ''
      }
      width="lg"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
            Resolution note
          </label>
          <textarea
            className="input-base min-h-[80px]"
            rows={3}
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="Describe what unblocked the work…"
            disabled={busy}
            autoFocus
          />
        </div>

        {/* Attachments list */}
        {attachments.length > 0 && (
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">
              Attached to resolution
            </div>
            <ul className="space-y-1.5">
              {attachments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start gap-2 px-3 py-2 rounded-lg border border-white/10 bg-navy-950/60"
                >
                  <span className="mt-0.5 text-teal">
                    {a.kind === 'file' ? <FileIcon size={14} /> : <NoteIcon size={14} />}
                  </span>
                  <div className="flex-1 min-w-0 text-xs">
                    <div className="text-white truncate">{a.name}</div>
                    {a.kind === 'note' && a.body && (
                      <div className="text-slate-400 mt-0.5 line-clamp-2 whitespace-pre-wrap">
                        {a.body}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(a.id)}
                    className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                    aria-label="Remove"
                  >
                    <CloseIcon size={12} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Add controls */}
        {mode === 'idle' && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || busy}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-navy-900/60 text-xs text-slate-300 hover:border-teal/40 hover:bg-teal/5 hover:text-white disabled:opacity-50"
            >
              {uploading ? <Spinner size={12} /> : <PlusIcon size={12} />}
              Attach file
            </button>
            <button
              type="button"
              onClick={() => setMode('note')}
              disabled={busy}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-navy-900/60 text-xs text-slate-300 hover:border-teal/40 hover:bg-teal/5 hover:text-white disabled:opacity-50"
            >
              <LinkIcon size={12} />
              Attach note / link
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => void handleFile(e)}
            />
          </div>
        )}

        {mode === 'note' && (
          <div className="space-y-2 rounded-lg border border-teal/20 bg-teal/5 p-2.5">
            <input
              type="text"
              placeholder="Title (e.g. PR link, fixed query)"
              value={noteName}
              onChange={(e) => setNoteName(e.target.value)}
              className="input-base !py-1.5 !text-xs"
            />
            <textarea
              placeholder="Paste a link, snippet, or write a note…"
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              className="input-base !py-1.5 !text-xs min-h-[50px]"
              rows={2}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMode('idle')}
                className="text-xs text-slate-400 hover:text-slate-200 px-2"
              >
                Cancel
              </button>
              <button type="button" onClick={addNote} className="btn-primary !py-1 !text-xs">
                Add
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-amber-300" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={handleSubmit} disabled={busy}>
            {busy ? <Spinner /> : null}
            Resolve and resume
          </button>
        </div>
      </div>
    </Modal>
  );
}
