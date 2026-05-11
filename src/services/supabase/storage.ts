import { supabase } from './client';
import { newId } from '../../lib/id';
import { asError } from '../../lib/errors';

const BUCKET = 'flowdesk-attachments';

export interface UploadedFile {
  storagePath: string;
  url: string;
  name: string;
  mimeType: string;
  size: number;
}

/**
 * Upload a file to the FlowDesk attachments bucket. Returns the public URL +
 * storage path. The path is namespaced with a random id so concurrent uploads
 * with the same filename don't collide.
 */
export async function uploadAttachment(file: File): Promise<UploadedFile> {
  const safeName = sanitize(file.name);
  const path = `${newId('att')}/${safeName}`;

  const { error } = await supabase().storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'application/octet-stream',
  });
  if (error) throw asError(error);

  const { data } = supabase().storage.from(BUCKET).getPublicUrl(path);
  return {
    storagePath: path,
    url: data.publicUrl,
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
  };
}

/** Best-effort delete; ignored on failure (file may already be gone). */
export async function deleteAttachment(storagePath: string): Promise<void> {
  await supabase().storage.from(BUCKET).remove([storagePath]);
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
}
