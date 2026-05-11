import { useRef, useState, type ChangeEvent } from 'react';
import { motion } from 'framer-motion';
import { uploadAttachment } from '../../services/supabase/storage';
import { newId } from '../../lib/id';
import { toErrorMessage } from '../../lib/errors';
import type { TaskAttachment } from '../../domain/types';
import { Spinner } from '../../ui/components/Spinner';
import {
  FileIcon,
  LinkIcon,
  NoteIcon,
  PaperclipIcon,
} from '../../ui/components/IconExtras';
import { CloseIcon, PlusIcon } from '../../ui/components/Icon';

interface Props {
  attachments: TaskAttachment[];
  onChange: (next: TaskAttachment[]) => void;
  onContinue: () => void;
}

type Mode = 'idle' | 'note';

export function AttachmentsStep({ attachments, onChange, onContinue }: Props) {
  const [mode, setMode] = useState<Mode>('idle');
  const [noteName, setNoteName] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [noteDescription, setNoteDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // reset so same file can be re-picked

    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadAttachment(file);
      const newAttachment: TaskAttachment = {
        id: newId('att'),
        kind: 'file',
        name: uploaded.name,
        description: '',
        url: uploaded.url,
        storagePath: uploaded.storagePath,
        mimeType: uploaded.mimeType,
        size: uploaded.size,
      };
      onChange([...attachments, newAttachment]);
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  function addNote() {
    const name = noteName.trim() || 'Note';
    const body = noteBody.trim();
    if (!body) {
      setError('Note body is required.');
      return;
    }
    onChange([
      ...attachments,
      {
        id: newId('att'),
        kind: 'note',
        name,
        description: noteDescription.trim(),
        body,
      },
    ]);
    setNoteName('');
    setNoteBody('');
    setNoteDescription('');
    setMode('idle');
    setError(null);
  }

  function updateDescription(id: string, description: string) {
    onChange(attachments.map((a) => (a.id === id ? { ...a, description } : a)));
  }

  function remove(id: string) {
    onChange(attachments.filter((a) => a.id !== id));
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-5 space-y-4"
    >
      <div className="flex items-center gap-2">
        <PaperclipIcon size={16} className="text-teal" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-teal/80">
          Attachments
        </span>
      </div>
      <p className="text-sm text-slate-400 -mt-2">
        Optional. Attach reference files (specs, mockups, datasets) or notes (links, snippets,
        constraints) the developer should see. Each item can carry a description.
      </p>

      {/* Existing attachments */}
      {attachments.length > 0 && (
        <ul className="space-y-2">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="rounded-xl border border-white/10 bg-navy-900/60 p-3 space-y-2"
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-teal">
                  {a.kind === 'file' ? <FileIcon size={16} /> : <NoteIcon size={16} />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{a.name}</div>
                  {a.kind === 'file' && a.size != null && (
                    <div className="text-[11px] font-mono text-slate-500">
                      {humanSize(a.size)} · {a.mimeType}
                    </div>
                  )}
                  {a.kind === 'note' && (
                    <div className="text-xs text-slate-300 mt-1 whitespace-pre-wrap line-clamp-3">
                      {a.body}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => remove(a.id)}
                  className="p-1 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                  aria-label="Remove"
                >
                  <CloseIcon size={14} />
                </button>
              </div>
              <input
                type="text"
                placeholder="Description / caption (optional)"
                value={a.description}
                onChange={(e) => updateDescription(a.id, e.target.value)}
                className="input-base !py-1.5 !text-xs"
              />
            </li>
          ))}
        </ul>
      )}

      {/* Add controls */}
      {mode === 'idle' && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-navy-900/60 text-sm text-slate-300 hover:border-teal/40 hover:bg-teal/5 hover:text-white disabled:opacity-50"
          >
            {uploading ? <Spinner size={14} /> : <PlusIcon size={14} />}
            Upload file
          </button>
          <button
            type="button"
            onClick={() => setMode('note')}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-navy-900/60 text-sm text-slate-300 hover:border-teal/40 hover:bg-teal/5 hover:text-white"
          >
            <LinkIcon size={14} />
            Add note / link
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
        <div className="space-y-2 rounded-xl border border-teal/20 bg-teal/5 p-3">
          <input
            type="text"
            placeholder="Title (e.g. Figma link, sample data, constraint)"
            value={noteName}
            onChange={(e) => setNoteName(e.target.value)}
            className="input-base !py-1.5 !text-sm"
            autoFocus
          />
          <textarea
            placeholder="Paste a link, snippet, or write a note…"
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            className="input-base !py-1.5 !text-sm min-h-[60px]"
            rows={3}
          />
          <input
            type="text"
            placeholder="Description / caption (optional)"
            value={noteDescription}
            onChange={(e) => setNoteDescription(e.target.value)}
            className="input-base !py-1.5 !text-xs"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setMode('idle');
                setError(null);
              }}
              className="text-xs text-slate-400 hover:text-slate-200 px-2"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={addNote}
              className="btn-primary !py-1.5 !text-xs"
            >
              Add note
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-amber-300" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end pt-2">
        <button type="button" onClick={onContinue} className="btn-primary">
          {attachments.length > 0 ? 'Continue with attachments' : 'Continue without attachments'}
        </button>
      </div>
    </motion.div>
  );
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
