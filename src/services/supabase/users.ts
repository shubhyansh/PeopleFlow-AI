import { supabase } from './client';
import { asError } from '../../lib/errors';
import type { User } from '../../domain/types';
import type { UserRow } from './schema';

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    name: row.name,
    role: row.role,
    designation: row.designation,
    description: row.description,
    createdAt: row.created_at,
  };
}

export async function listUsers(): Promise<User[]> {
  const { data, error } = await supabase()
    .from('users')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw asError(error);
  return ((data ?? []) as UserRow[]).map(rowToUser);
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const trimmed = username.trim();
  const { data, error } = await supabase()
    .from('users')
    .select('*')
    .ilike('username', trimmed)
    .maybeSingle();
  if (error) throw asError(error);
  return data ? rowToUser(data as UserRow) : null;
}

export async function addUser(user: User): Promise<void> {
  const { error } = await supabase()
    .from('users')
    .insert({
      id: user.id,
      username: user.username,
      password_hash: user.passwordHash, // may be null — employee sets on first login
      name: user.name,
      role: user.role,
      designation: user.designation,
      description: user.description,
    });
  if (error) throw asError(error);
}

/** Used on first login to persist the password the employee just set. */
export async function setPasswordHash(id: string, passwordHash: string): Promise<void> {
  const { error } = await supabase()
    .from('users')
    .update({ password_hash: passwordHash })
    .eq('id', id);
  if (error) throw asError(error);
}

export async function deleteUser(id: string): Promise<void> {
  const { error } = await supabase().from('users').delete().eq('id', id);
  if (error) throw asError(error);
}

export async function updateUser(id: string, patch: Partial<User>): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.username !== undefined) update.username = patch.username;
  if (patch.passwordHash !== undefined) update.password_hash = patch.passwordHash;
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.role !== undefined) update.role = patch.role;
  if (patch.designation !== undefined) update.designation = patch.designation;
  if (patch.description !== undefined) update.description = patch.description;

  const { error } = await supabase().from('users').update(update).eq('id', id);
  if (error) throw asError(error);
}
