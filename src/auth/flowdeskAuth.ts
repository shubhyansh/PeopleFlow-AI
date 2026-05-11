import { hashPassword, verifyPassword } from '../lib/crypto';
import { getUserByUsername, setPasswordHash } from '../services/supabase/users';
import type { SessionUser } from '../domain/types';

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'Admin@123';

const ADMIN_SESSION: SessionUser = {
  id: 'admin',
  username: ADMIN_USERNAME,
  name: 'Administrator',
  role: 'admin',
};

const MIN_PASSWORD_LENGTH = 6;

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid username or password');
    this.name = 'InvalidCredentialsError';
  }
}

export class WeakPasswordError extends Error {
  constructor() {
    super(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    this.name = 'WeakPasswordError';
  }
}

/**
 * Result of a sign-in attempt.
 *
 * - `signed-in` — verified existing user
 * - `password-set` — first-time login; the password the employee entered has
 *   just been saved as their password and they are now signed in
 */
export type SignInResult =
  | { kind: 'signed-in'; user: SessionUser }
  | { kind: 'password-set'; user: SessionUser };

/**
 * Verifies FlowDesk credentials. Behavior:
 *  - hardcoded admin → returns admin session
 *  - existing user with stored password → bcrypt verify
 *  - existing user with NO stored password → first login: hash the entered
 *    password, save it, return signed-in (kind = 'password-set')
 */
export async function signIn(username: string, password: string): Promise<SignInResult> {
  const trimmedUser = username.trim();

  if (trimmedUser === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    return { kind: 'signed-in', user: ADMIN_SESSION };
  }

  const user = await getUserByUsername(trimmedUser);
  if (!user) throw new InvalidCredentialsError();

  if (user.passwordHash === null || user.passwordHash === '') {
    // First login — the password they typed becomes their password.
    if (password.length < MIN_PASSWORD_LENGTH) throw new WeakPasswordError();
    const newHash = await hashPassword(password);
    await setPasswordHash(user.id, newHash);
    return {
      kind: 'password-set',
      user: { id: user.id, username: user.username, name: user.name, role: user.role },
    };
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw new InvalidCredentialsError();

  return {
    kind: 'signed-in',
    user: { id: user.id, username: user.username, name: user.name, role: user.role },
  };
}
