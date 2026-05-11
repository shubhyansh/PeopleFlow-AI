import { useEffect, useState, type FormEvent } from 'react';
import type { User } from '../../domain/types';
import { newId } from '../../lib/id';
import { toErrorMessage } from '../../lib/errors';
import { addUser, getUserByUsername, updateUser } from '../../services/supabase/users';
import { Spinner } from '../../ui/components/Spinner';

interface Props {
  mode: 'create' | 'edit';
  initial?: User;
  onSaved: (user: User) => void;
  onCancel: () => void;
}

/**
 * Admin only sets profile fields. Passwords are NEVER set by admin —
 * the employee picks their password on first login (see flowdeskAuth.ts).
 */
export function EmployeeForm({ mode, initial, onSaved, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [username, setUsername] = useState(initial?.username ?? '');
  const [designation, setDesignation] = useState(initial?.designation ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'edit' && initial) {
      setName(initial.name);
      setUsername(initial.username);
      setDesignation(initial.designation);
      setDescription(initial.description);
    }
  }, [mode, initial]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedUsername = username.trim();
    const trimmedName = name.trim();

    if (!trimmedName || !trimmedUsername) {
      setError('Name and username are required.');
      return;
    }
    if (trimmedUsername.toLowerCase() === 'admin') {
      setError('"admin" is reserved.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'create') {
        const existing = await getUserByUsername(trimmedUsername);
        if (existing) {
          setError(`Username "${trimmedUsername}" is already taken.`);
          setBusy(false);
          return;
        }
        const user: User = {
          id: newId('usr'),
          username: trimmedUsername,
          passwordHash: null, // employee sets it on first login
          name: trimmedName,
          role: 'employee',
          designation: designation.trim(),
          description: description.trim(),
          createdAt: new Date().toISOString(),
        };
        await addUser(user);
        onSaved(user);
      } else if (initial) {
        const patch: Partial<User> = {
          name: trimmedName,
          username: trimmedUsername,
          designation: designation.trim(),
          description: description.trim(),
        };
        await updateUser(initial.id, patch);
        onSaved({ ...initial, ...patch });
      }
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
            Full name
          </label>
          <input
            type="text"
            className="input-base"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
            Username
          </label>
          <input
            type="text"
            className="input-base font-mono"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="off"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
          Designation
        </label>
        <input
          type="text"
          className="input-base"
          value={designation}
          onChange={(e) => setDesignation(e.target.value)}
          placeholder="e.g. Senior Frontend Engineer"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
          Description
        </label>
        <textarea
          className="input-base min-h-[80px]"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Notes about this person — strengths, focus areas…"
          rows={3}
        />
      </div>

      {mode === 'create' && (
        <div className="px-4 py-3 rounded-xl border border-teal/20 bg-teal/5 text-teal/90 text-xs leading-relaxed">
          The employee will set their own password the first time they sign in. Just share their
          username with them.
        </div>
      )}

      {error && (
        <p className="text-sm text-amber-300" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? <Spinner /> : null}
          {mode === 'create' ? 'Create employee' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
