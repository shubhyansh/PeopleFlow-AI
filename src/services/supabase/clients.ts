import { supabase } from './client';
import { asError } from '../../lib/errors';
import type { Client } from '../../domain/types';
import type { ClientRow } from './schema';

export async function listClients(): Promise<Client[]> {
  const { data, error } = await supabase()
    .from('clients')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw asError(error);
  return ((data ?? []) as ClientRow[]).map((row) => ({ id: row.id, name: row.name }));
}

export async function addClient(client: Client): Promise<void> {
  const { error } = await supabase().from('clients').insert({
    id: client.id,
    name: client.name,
  });
  if (error) throw asError(error);
}
