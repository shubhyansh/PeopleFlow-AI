import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../auth/AuthContext';
import { InvalidCredentialsError, WeakPasswordError } from '../auth/flowdeskAuth';
import { Spinner } from '../ui/components/Spinner';
import { ipc } from '../lib/ipc';

export default function Login() {
  const navigate = useNavigate();
  const { configError, flowdeskUser, signIn } = useAuth();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (flowdeskUser) {
      const target = flowdeskUser.role === 'admin' ? '/admin' : '/employee';
      const t = setTimeout(() => navigate(target, { replace: true }), info ? 600 : 0);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [flowdeskUser, navigate, info]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const result = await signIn(username, password);
      if (result.kind === 'password-set') {
        setInfo('Password set. Welcome to FlowDesk!');
      }
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        setError('Invalid username or password.');
      } else if (err instanceof WeakPasswordError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Sign-in failed');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md glass-card p-8"
      >
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-teal shadow-teal-glow" />
            <span className="font-mono text-xs text-teal tracking-wider uppercase">FlowDesk</span>
          </div>
          <h1 className="font-display text-3xl font-semibold text-white">Welcome back</h1>
          <p className="text-slate-400 text-sm mt-2">
            Sign in with your FlowDesk credentials. First time? The password you enter will be set as
            your password.
          </p>
        </div>

        {configError && (
          <div className="mb-6 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-sm">
            {configError}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
              Username
            </label>
            <input
              type="text"
              className="input-base"
              placeholder="admin or your assigned ID"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
              Password
            </label>
            <input
              type="password"
              className="input-base"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {info && (
            <p className="text-sm text-teal" role="status">
              {info}
            </p>
          )}
          {error && (
            <p className="text-sm text-amber-300" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={busy || !!configError}>
            {busy ? <Spinner /> : null}
            Sign in
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-white/5 text-center">
          <button
            type="button"
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            onClick={async () => {
              if (
                window.confirm(
                  'Disconnect from this Supabase project? You will be sent back to setup.',
                )
              ) {
                await ipc.config.clearSupabase();
                window.location.reload();
              }
            }}
          >
            Switch Supabase project
          </button>
        </div>
      </motion.div>
    </div>
  );
}
