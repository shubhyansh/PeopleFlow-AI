/**
 * Normalises any thrown value into a readable string.
 *
 * Supabase / PostgREST returns errors as plain objects of shape
 * `{ message, details, hint, code }` — `instanceof Error` is false, so naive
 * `String(e)` yields "[object Object]". This helper handles all cases.
 */
export function toErrorMessage(e: unknown): string {
  if (e == null) return 'Unknown error';
  if (e instanceof Error) return e.message;

  if (typeof e === 'object') {
    const obj = e as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };
    if (typeof obj.message === 'string' && obj.message.length > 0) {
      const parts = [obj.message];
      if (typeof obj.details === 'string' && obj.details.length > 0) parts.push(obj.details);
      if (typeof obj.hint === 'string' && obj.hint.length > 0) parts.push(`(${obj.hint})`);
      if (typeof obj.code === 'string' && obj.code.length > 0) parts.push(`[${obj.code}]`);
      return parts.join(' — ');
    }
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  }

  return String(e);
}

/** Wrap a thrown value as a real Error so `instanceof Error` works downstream. */
export function asError(e: unknown): Error {
  if (e instanceof Error) return e;
  return new Error(toErrorMessage(e));
}
