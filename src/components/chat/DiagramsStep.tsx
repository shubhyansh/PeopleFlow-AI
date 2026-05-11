import { useRef, useState, type ChangeEvent } from 'react';
import { motion } from 'framer-motion';
import { uploadAttachment } from '../../services/supabase/storage';
import { newId } from '../../lib/id';
import { toErrorMessage } from '../../lib/errors';
import type { TaskAttachment } from '../../domain/types';
import { Spinner } from '../../ui/components/Spinner';
import { CloseIcon, PlusIcon } from '../../ui/components/Icon';

interface Props {
  /** Existing attachments — diagrams are filtered out by image MIME type. */
  attachments: TaskAttachment[];
  onChange: (next: TaskAttachment[]) => void;
  onContinue: () => void;
}

/**
 * Image-only upload step. Anything dropped here is added to the task's
 * attachments with image MIME types — the drawer renders these as thumbnails.
 *
 * Other attachments (notes, non-image files) are managed by the regular
 * AttachmentsStep one step later.
 */
export function DiagramsStep({ attachments, onChange, onContinue }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Show only image attachments here; rest stay untouched
  const diagrams = attachments.filter(
    (a) => a.kind === 'file' && a.mimeType?.startsWith('image/'),
  );

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!file.type.startsWith('image/')) {
      setError('Only image files in this step. Use the Attachments step for other files.');
      return;
    }
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
      <div>
        <div className="font-mono text-[10px] text-teal uppercase tracking-wider mb-1">
          Diagrams & mockups
        </div>
        <p className="text-xs text-slate-400">
          Drop in flow diagrams, architecture sketches, mockups, or screenshots — anything visual
          that helps the developer see how it should work. Optional.
        </p>
      </div>

      {diagrams.length > 0 && (
        <ul className="grid grid-cols-2 gap-3">
          {diagrams.map((d) => (
            <li
              key={d.id}
              className="rounded-xl border border-white/10 bg-navy-950/40 overflow-hidden"
            >
              <div className="aspect-video bg-navy-900 flex items-center justify-center overflow-hidden">
                {d.url ? (
                  <img
                    src={d.url}
                    alt={d.name}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-xs text-slate-500">No preview</span>
                )}
              </div>
              <div className="p-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white truncate flex-1">{d.name}</span>
                  <button
                    type="button"
                    onClick={() => remove(d.id)}
                    className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                    aria-label="Remove"
                  >
                    <CloseIcon size={12} />
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Caption (optional)"
                  value={d.description}
                  onChange={(e) => updateDescription(d.id, e.target.value)}
                  className="input-base !py-1 !text-[11px]"
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-navy-900/60 text-sm text-slate-300 hover:border-teal/40 hover:bg-teal/5 hover:text-white disabled:opacity-50"
        >
          {uploading ? <Spinner size={14} /> : <PlusIcon size={14} />}
          Upload image
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void handleFile(e)}
        />
      </div>

      {error && (
        <p className="text-xs text-amber-300" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end pt-1">
        <button type="button" onClick={onContinue} className="btn-primary">
          {diagrams.length > 0 ? 'Continue' : 'Skip — no diagrams'}
        </button>
      </div>
    </motion.div>
  );
}
