import { describe, expect, it } from 'vitest';
import { MemoryDb, type Row } from '../memoryDb';

function db(rows: Row[] = []): MemoryDb {
  return new MemoryDb({ widgets: rows });
}

const SAMPLE: Row[] = [
  { id: 'b', name: 'Beta', owner: 'mei', rank: 2, created_at: '2026-02-01T00:00:00.000Z' },
  { id: 'a', name: 'Alpha', owner: 'priya', rank: 1, created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'c', name: 'Gamma', owner: 'mei', rank: 3, created_at: '2026-03-01T00:00:00.000Z' },
];

describe('MemoryDb select', () => {
  it('returns every row when unfiltered', async () => {
    const { data, error } = await db(SAMPLE).from('widgets').select('*');
    expect(error).toBeNull();
    expect(data).toHaveLength(3);
  });

  it('orders ascending by default and descending on request', async () => {
    const asc = await db(SAMPLE).from('widgets').select('*').order('created_at');
    expect((asc.data as Row[]).map((r) => r.id)).toEqual(['a', 'b', 'c']);

    const desc = await db(SAMPLE)
      .from('widgets')
      .select('*')
      .order('created_at', { ascending: false });
    expect((desc.data as Row[]).map((r) => r.id)).toEqual(['c', 'b', 'a']);
  });

  it('filters with eq', async () => {
    const { data } = await db(SAMPLE).from('widgets').select('*').eq('owner', 'mei');
    expect((data as Row[]).map((r) => r.id).sort()).toEqual(['b', 'c']);
  });

  it('matches ilike case-insensitively', async () => {
    const { data } = await db(SAMPLE).from('widgets').select('*').ilike('name', 'ALPHA');
    expect((data as Row[])[0].id).toBe('a');
  });

  it('supports the % wildcard in ilike', async () => {
    const { data } = await db(SAMPLE).from('widgets').select('*').ilike('name', 'a%');
    expect((data as Row[]).map((r) => r.id)).toEqual(['a']);
  });

  it('returns null from maybeSingle when nothing matches', async () => {
    const { data, error } = await db(SAMPLE)
      .from('widgets')
      .select('*')
      .eq('owner', 'nobody')
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it('errors from maybeSingle when more than one row matches', async () => {
    const { data, error } = await db(SAMPLE)
      .from('widgets')
      .select('*')
      .eq('owner', 'mei')
      .maybeSingle();
    expect(data).toBeNull();
    expect(error?.code).toBe('PGRST116');
  });

  it('applies limit after ordering', async () => {
    const { data } = await db(SAMPLE)
      .from('widgets')
      .select('rank')
      .order('rank', { ascending: false })
      .limit(1);
    expect(data).toEqual([{ rank: 3 }]);
  });

  it('projects only the requested columns', async () => {
    const { data } = await db(SAMPLE).from('widgets').select('id,name').eq('id', 'a');
    expect(data).toEqual([{ id: 'a', name: 'Alpha' }]);
  });

  it('returns a count without rows for a head query', async () => {
    const { data, count } = await db(SAMPLE)
      .from('widgets')
      .select('id', { count: 'exact', head: true });
    expect(data).toBeNull();
    expect(count).toBe(3);
  });

  it('reads an unknown table as empty rather than throwing', async () => {
    const { data, error } = await db(SAMPLE).from('nothing_here').select('*');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('hands back copies, so a caller cannot mutate the store', async () => {
    const store = db(SAMPLE);
    const { data } = await store.from('widgets').select('*').eq('id', 'a');
    (data as Row[])[0].name = 'tampered';
    const again = await store.from('widgets').select('*').eq('id', 'a');
    expect((again.data as Row[])[0].name).toBe('Alpha');
  });
});

describe('MemoryDb writes', () => {
  it('inserts and stamps created_at when absent', async () => {
    const store = db();
    await store.from('widgets').insert({ id: 'x', name: 'New' });
    const [row] = store.rows('widgets');
    expect(row.name).toBe('New');
    expect(typeof row.created_at).toBe('string');
  });

  it('keeps a supplied created_at', async () => {
    const store = db();
    await store.from('widgets').insert({ id: 'x', created_at: '2020-01-01T00:00:00.000Z' });
    expect(store.rows('widgets')[0].created_at).toBe('2020-01-01T00:00:00.000Z');
  });

  it('updates only the matching rows', async () => {
    const store = db(SAMPLE);
    await store.from('widgets').update({ owner: 'tom' }).eq('id', 'a');
    const rows = store.rows('widgets');
    expect(rows.find((r) => r.id === 'a')?.owner).toBe('tom');
    expect(rows.find((r) => r.id === 'b')?.owner).toBe('mei');
  });

  it('deletes only the matching rows', async () => {
    const store = db(SAMPLE);
    await store.from('widgets').delete().eq('owner', 'mei');
    expect(store.rows('widgets').map((r) => r.id)).toEqual(['a']);
  });

  it('upsert inserts when the id is new', async () => {
    const store = db(SAMPLE);
    await store.from('widgets').upsert({ id: 'd', name: 'Delta' });
    expect(store.rows('widgets')).toHaveLength(4);
  });

  it('upsert merges when the id already exists', async () => {
    const store = db(SAMPLE);
    await store.from('widgets').upsert({ id: 'a', name: 'Renamed' });
    const rows = store.rows('widgets');
    expect(rows).toHaveLength(3);
    const a = rows.find((r) => r.id === 'a');
    expect(a?.name).toBe('Renamed');
    expect(a?.owner).toBe('priya'); // untouched columns survive
  });

  it('does not capture the seed array by reference', async () => {
    const seedRows: Row[] = [{ id: 'a', name: 'Alpha' }];
    const store = new MemoryDb({ widgets: seedRows });
    await store.from('widgets').update({ name: 'Changed' }).eq('id', 'a');
    expect(seedRows[0].name).toBe('Alpha');
  });
});

describe('MemoryDb storage', () => {
  it('round-trips an upload through getPublicUrl', async () => {
    const store = db();
    const bucket = store.storage.from('attachments');
    await bucket.upload('att-1/diagram.png', new Blob(['x']));
    expect(bucket.getPublicUrl('att-1/diagram.png').data.publicUrl).not.toBe('');
  });

  it('returns an empty url for an unknown path', () => {
    expect(db().storage.from('attachments').getPublicUrl('missing').data.publicUrl).toBe('');
  });

  it('forgets a removed object', async () => {
    const store = db();
    const bucket = store.storage.from('attachments');
    await bucket.upload('att-2/notes.txt', new Blob(['x']));
    await bucket.remove(['att-2/notes.txt']);
    expect(bucket.getPublicUrl('att-2/notes.txt').data.publicUrl).toBe('');
  });

  it('hands back the same bucket for the same name', () => {
    const store = db();
    expect(store.storage.from('attachments')).toBe(store.storage.from('attachments'));
  });
});
