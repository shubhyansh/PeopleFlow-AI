import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../crypto';

/**
 * These hashes were produced by bcryptjs 2.4.3 at cost 10 and are checked in
 * deliberately. A password hashed by the version we ship today has to keep
 * verifying after a bcryptjs major bump, because every stored password in
 * Supabase was written by the old version and nothing rehashes them on
 * upgrade. Generating a hash inside the test would only prove the new version
 * agrees with itself.
 */
const FIXTURES = {
  ascii: {
    plain: 'correct horse battery staple',
    hash: '$2a$10$h1TkNmJKBbchRaUfczuHbO/BBAehwHvl7AR/ng/.n4VL07M0WB9Ou',
  },
  unicode: {
    plain: 'pässwörd-üñîçøde',
    hash: '$2a$10$F2wYEZwSXrDGlnk0Ns9NKupXCJp1jZZQwyAE3t/v16oNxyvGt6QB.',
  },
  empty: {
    plain: '',
    hash: '$2a$10$RNF3U2URDNbwKBYuEfpVHORdPQjE.5qoLgt2C9ARsFb496CJqQJyi',
  },
} as const;

describe('verifyPassword against hashes written by an older bcryptjs', () => {
  it('accepts an ASCII password', async () => {
    await expect(verifyPassword(FIXTURES.ascii.plain, FIXTURES.ascii.hash)).resolves.toBe(true);
  });

  it('accepts a password with non-ASCII characters', async () => {
    await expect(verifyPassword(FIXTURES.unicode.plain, FIXTURES.unicode.hash)).resolves.toBe(true);
  });

  it('accepts an empty password', async () => {
    await expect(verifyPassword(FIXTURES.empty.plain, FIXTURES.empty.hash)).resolves.toBe(true);
  });

  it('rejects the wrong password', async () => {
    await expect(verifyPassword('wrong', FIXTURES.ascii.hash)).resolves.toBe(false);
  });

  it('does not confuse two fixtures with each other', async () => {
    await expect(verifyPassword(FIXTURES.ascii.plain, FIXTURES.unicode.hash)).resolves.toBe(false);
  });

  /**
   * bcrypt hashes differ only in the version tag here; `$2b$` fixed a
   * length-handling bug that never affected passwords this short. Supabase
   * rows written by other tooling can carry either tag, so both have to
   * verify.
   */
  it('accepts the same digest under a $2b$ version tag', async () => {
    const asTwoB = FIXTURES.ascii.hash.replace(/^\$2a\$/, '$2b$');
    expect(asTwoB.startsWith('$2b$')).toBe(true);
    await expect(verifyPassword(FIXTURES.ascii.plain, asTwoB)).resolves.toBe(true);
  });
});

describe('verifyPassword on input that is not a hash', () => {
  // Returning false rather than throwing is what the login path depends on:
  // `flowdeskAuth` treats a rejected promise as an outage, not as bad
  // credentials. If a bcryptjs major starts throwing here, this test is the
  // warning and the call site needs a guard before the bump lands.
  it('returns false for a malformed hash', async () => {
    await expect(verifyPassword('anything', 'not-a-bcrypt-hash')).resolves.toBe(false);
  });

  it('returns false for an empty hash', async () => {
    await expect(verifyPassword('anything', '')).resolves.toBe(false);
  });
});

describe('hashPassword', () => {
  it('produces a hash that verifies', async () => {
    const hash = await hashPassword('round-trips fine');
    await expect(verifyPassword('round-trips fine', hash)).resolves.toBe(true);
    await expect(verifyPassword('round-trips fin', hash)).resolves.toBe(false);
  });

  it('salts, so the same password never yields the same hash twice', async () => {
    const [a, b] = await Promise.all([hashPassword('same input'), hashPassword('same input')]);
    expect(a).not.toBe(b);
  });

  // The cost is asserted; the version tag is not pinned to `$2a$`, because a
  // bcryptjs major is allowed to start emitting `$2b$` and that is not a
  // regression. Dropping the cost would be.
  it('uses cost 10 and a recognised version tag', async () => {
    const hash = await hashPassword('inspect me');
    expect(hash).toMatch(/^\$2[aby]\$10\$/);
    expect(hash).toHaveLength(60);
  });
});
