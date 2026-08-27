/**
 * An in-memory stand-in for the subset of PostgREST that FlowDesk actually
 * uses. It exists so the app can run with no Supabase project behind it --
 * the published browser demo, and any future integration test, both point at
 * this instead of a network.
 *
 * The important design decision: this fake sits at the *transport* boundary,
 * not above it. `src/services/supabase/*` -- the row mapping, the error
 * handling, the column names -- runs unmodified against it, so the demo
 * exercises the same data-access code as the desktop build. Only the wire is
 * different.
 *
 * Supported chain shapes (everything the services layer issues):
 *   from(t).select('*').order(col, { ascending })
 *   from(t).select('*').eq(col, v).maybeSingle()
 *   from(t).select('*').ilike(col, v).maybeSingle()
 *   from(t).select(col).eq(col, v).order(col, { ascending }).limit(n)
 *   from(t).select('id', { count: 'exact', head: true })
 *   from(t).insert(row) / .update(patch).eq(col, v) / .delete().eq(col, v) / .upsert(row)
 */

export type Row = Record<string, unknown>;

export interface QueryResult<T> {
  data: T;
  error: { message: string; code?: string } | null;
  count?: number;
}

type Filter = (row: Row) => boolean;

/** Rows are cloned on the way in and on the way out so callers cannot mutate the store by reference. */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a) < String(b) ? -1 : 1;
}

/** PostgREST `ilike` semantics: case-insensitive, `%` is the wildcard. */
function ilikeMatch(value: unknown, pattern: string): boolean {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*');
  return new RegExp(`^${escaped}$`, 'i').test(String(value ?? ''));
}

class MemoryQuery<T> implements PromiseLike<QueryResult<T>> {
  private filters: Filter[] = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private limitTo: number | null = null;
  private single = false;
  private columns: string[] | null = null;
  private headOnly = false;
  private wantCount = false;

  constructor(
    private readonly table: Row[],
    private readonly tableName: string,
    private readonly operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert',
    private readonly payload?: Row,
  ) {}

  select(columns = '*', opts?: { count?: 'exact'; head?: boolean }): this {
    this.columns = columns === '*' ? null : columns.split(',').map((c) => c.trim());
    this.headOnly = opts?.head === true;
    this.wantCount = opts?.count === 'exact';
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  ilike(column: string, value: string): this {
    this.filters.push((row) => ilikeMatch(row[column], value));
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }): this {
    this.orderBy = { column, ascending: opts?.ascending !== false };
    return this;
  }

  limit(n: number): this {
    this.limitTo = n;
    return this;
  }

  maybeSingle(): this {
    this.single = true;
    return this;
  }

  private matching(): Row[] {
    return this.table.filter((row) => this.filters.every((f) => f(row)));
  }

  private run(): QueryResult<unknown> {
    switch (this.operation) {
      case 'insert': {
        const row = clone(this.payload ?? {});
        if (!row.created_at) row.created_at = new Date().toISOString();
        this.table.push(row);
        return { data: null, error: null };
      }
      case 'upsert': {
        const row = clone(this.payload ?? {});
        const index = this.table.findIndex((r) => r.id === row.id);
        if (index >= 0) {
          this.table[index] = { ...this.table[index], ...row };
        } else {
          if (!row.created_at) row.created_at = new Date().toISOString();
          this.table.push(row);
        }
        return { data: null, error: null };
      }
      case 'update': {
        for (const row of this.matching()) Object.assign(row, clone(this.payload ?? {}));
        return { data: null, error: null };
      }
      case 'delete': {
        for (const row of this.matching()) {
          const index = this.table.indexOf(row);
          if (index >= 0) this.table.splice(index, 1);
        }
        return { data: null, error: null };
      }
      case 'select':
      default: {
        let rows = this.matching();
        if (this.orderBy) {
          const { column, ascending } = this.orderBy;
          rows = [...rows].sort(
            (a, b) => compare(a[column], b[column]) * (ascending ? 1 : -1),
          );
        }
        if (this.limitTo !== null) rows = rows.slice(0, this.limitTo);

        // PostgREST only reports a count when one was asked for.
        const count = this.wantCount ? rows.length : undefined;
        if (this.headOnly) return { data: null, error: null, count };

        let projected = clone(rows);
        if (this.columns) {
          const cols = this.columns;
          projected = projected.map((row) =>
            Object.fromEntries(cols.map((c) => [c, row[c]])) as Row,
          );
        }

        if (this.single) {
          if (projected.length > 1) {
            return {
              data: null,
              error: {
                message: `More than one row returned from ${this.tableName}`,
                code: 'PGRST116',
              },
            };
          }
          return { data: projected[0] ?? null, error: null, count };
        }
        return { data: projected, error: null, count };
      }
    }
  }

  then<R1 = QueryResult<T>, R2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    let result: QueryResult<T>;
    try {
      result = this.run() as QueryResult<T>;
    } catch (e) {
      return Promise.resolve().then(() =>
        onrejected ? onrejected(e) : Promise.reject(e),
      ) as PromiseLike<R1 | R2>;
    }
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }
}

class MemoryBucket {
  private readonly objects = new Map<string, string>();

  async upload(
    path: string,
    file: Blob,
    _opts?: unknown,
  ): Promise<{ error: { message: string } | null }> {
    // Object URLs keep the demo's attachment previews working for the life of
    // the tab without a network round trip. Outside a browser (the unit
    // suite runs on node) fall back to an opaque marker.
    const hasObjectUrls =
      typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
    this.objects.set(path, hasObjectUrls ? URL.createObjectURL(file) : `memory://${path}`);
    return { error: null };
  }

  getPublicUrl(path: string): { data: { publicUrl: string } } {
    return { data: { publicUrl: this.objects.get(path) ?? '' } };
  }

  async remove(paths: string[]): Promise<{ error: null }> {
    for (const path of paths) {
      const url = this.objects.get(path);
      if (url?.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(url);
      }
      this.objects.delete(path);
    }
    return { error: null };
  }
}

export class MemoryDb {
  private readonly tables = new Map<string, Row[]>();
  private readonly buckets = new Map<string, MemoryBucket>();

  constructor(seed: Record<string, Row[]> = {}) {
    for (const [name, rows] of Object.entries(seed)) this.tables.set(name, clone(rows));
  }

  private table(name: string): Row[] {
    let rows = this.tables.get(name);
    if (!rows) {
      rows = [];
      this.tables.set(name, rows);
    }
    return rows;
  }

  from(name: string) {
    const rows = this.table(name);
    return {
      select: (columns?: string, opts?: { count?: 'exact'; head?: boolean }) =>
        new MemoryQuery(rows, name, 'select').select(columns, opts),
      insert: (payload: Row) => new MemoryQuery(rows, name, 'insert', payload),
      update: (payload: Row) => new MemoryQuery(rows, name, 'update', payload),
      upsert: (payload: Row) => new MemoryQuery(rows, name, 'upsert', payload),
      delete: () => new MemoryQuery(rows, name, 'delete'),
    };
  }

  readonly storage = {
    from: (bucket: string): MemoryBucket => {
      let b = this.buckets.get(bucket);
      if (!b) {
        b = new MemoryBucket();
        this.buckets.set(bucket, b);
      }
      return b;
    },
  };

  /** Snapshot of a table, for assertions. */
  rows(name: string): Row[] {
    return clone(this.table(name));
  }
}
