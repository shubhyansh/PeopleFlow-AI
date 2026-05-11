import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Spinner } from '../ui/components/Spinner';
import { ipc } from '../lib/ipc';
import { setSupabaseConfig, testSupabaseConnection } from '../services/supabase/client';
// Bundled at build time so the user can copy it inside the app without opening the repo.
import setupSql from '../../supabase/setup.sql?raw';

interface Props {
  initialConfig?: { url: string; anonKey: string } | null;
  hasGroqKey?: boolean;
  onConfigured: () => void;
}

type TestState =
  | { kind: 'idle' }
  | { kind: 'testing' }
  | { kind: 'ok' }
  | { kind: 'error'; reason: string };

export default function SetupScreen({ initialConfig, hasGroqKey, onConfigured }: Props) {
  const [url, setUrl] = useState(initialConfig?.url ?? '');
  const [anonKey, setAnonKey] = useState(initialConfig?.anonKey ?? '');
  const [groqKey, setGroqKey] = useState('');
  const [test, setTest] = useState<TestState>({ kind: 'idle' });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSql, setShowSql] = useState(false);

  function urlLooksValid(): boolean {
    return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url.trim());
  }
  function keyLooksValid(): boolean {
    const trimmed = anonKey.trim();
    return trimmed.startsWith('eyJ') && trimmed.length > 100;
  }
  const formReady = urlLooksValid() && keyLooksValid();

  async function handleTest() {
    if (!formReady) return;
    setTest({ kind: 'testing' });
    const result = await testSupabaseConnection({ url: url.trim(), anonKey: anonKey.trim() });
    if (result.ok) {
      setTest({ kind: 'ok' });
    } else {
      setTest({ kind: 'error', reason: result.reason });
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!formReady) return;
    setSaving(true);
    try {
      const cfg = { url: url.trim(), anonKey: anonKey.trim() };
      await ipc.config.setSupabase(cfg);
      setSupabaseConfig(cfg);
      const trimmedGroq = groqKey.trim();
      if (trimmedGroq) {
        await ipc.config.setGroq(trimmedGroq);
      }
      onConfigured();
    } catch (err) {
      setTest({
        kind: 'error',
        reason: err instanceof Error ? err.message : 'Failed to save configuration.',
      });
      setSaving(false);
    }
  }

  async function copySql() {
    try {
      await navigator.clipboard.writeText(setupSql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore — fall back to the visible textarea
    }
  }

  return (
    <div className="min-h-screen flex items-start justify-center px-6 py-12 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-2xl glass-card p-8"
      >
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-teal shadow-teal-glow" />
            <span className="font-mono text-xs text-teal tracking-wider uppercase">
              First-time setup
            </span>
          </div>
          <h1 className="font-display text-3xl font-semibold text-white">
            Connect your Supabase
          </h1>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed">
            FlowDesk stores everything in <em>your</em> Supabase project — your team, your data,
            your laws of physics. Three steps, ~3 minutes.
          </p>
        </div>

        <form onSubmit={handleSave}>
        <ol className="space-y-6">
          <li>
            <div className="flex items-baseline gap-3 mb-2">
              <span className="font-mono text-xs text-teal">01</span>
              <h2 className="font-display text-lg font-medium text-white">
                Create a free Supabase project
              </h2>
            </div>
            <p className="text-slate-400 text-sm pl-8">
              Go to{' '}
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="text-teal hover:underline"
              >
                supabase.com/dashboard
              </a>{' '}
              → <span className="text-slate-200">New project</span>. Pick any region close to your
              team. The free tier is plenty.
            </p>
          </li>

          <li>
            <div className="flex items-baseline gap-3 mb-2">
              <span className="font-mono text-xs text-teal">02</span>
              <h2 className="font-display text-lg font-medium text-white">
                Run the bootstrap SQL
              </h2>
            </div>
            <div className="pl-8 space-y-2">
              <p className="text-slate-400 text-sm">
                In your project, open <span className="text-slate-200">SQL Editor → New query</span>
                , paste the script below, and click <span className="text-slate-200">Run</span>.
              </p>
              <div className="flex items-center gap-2">
                <button type="button" className="btn-ghost text-xs" onClick={copySql}>
                  {copied ? 'Copied ✓' : 'Copy setup SQL'}
                </button>
                <button
                  type="button"
                  className="text-xs text-slate-400 hover:text-slate-200"
                  onClick={() => setShowSql((s) => !s)}
                >
                  {showSql ? 'Hide SQL' : 'Show SQL'}
                </button>
              </div>
              {showSql && (
                <textarea
                  readOnly
                  value={setupSql}
                  className="w-full h-48 mt-2 font-mono text-xs bg-slate-950/70 text-slate-200 border border-slate-800 rounded-lg p-3"
                />
              )}
            </div>
          </li>

          <li>
            <div className="flex items-baseline gap-3 mb-2">
              <span className="font-mono text-xs text-teal">03</span>
              <h2 className="font-display text-lg font-medium text-white">
                Paste your project URL + anon key
              </h2>
            </div>
            <p className="text-slate-400 text-sm pl-8 mb-3">
              In Supabase: <span className="text-slate-200">Settings → API</span>. Copy{' '}
              <span className="text-slate-200">Project URL</span> and the{' '}
              <span className="text-slate-200">anon public</span> key (not service_role).
            </p>

            <div className="space-y-4 pl-8">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                  Project URL
                </label>
                <input
                  type="url"
                  className="input-base font-mono text-sm"
                  placeholder="https://abcdefghijklmno.supabase.co"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setTest({ kind: 'idle' });
                  }}
                  autoComplete="off"
                  spellCheck={false}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                  Anon public key
                </label>
                <textarea
                  className="input-base font-mono text-xs h-24 resize-none"
                  placeholder="eyJhbGciOi..."
                  value={anonKey}
                  onChange={(e) => {
                    setAnonKey(e.target.value);
                    setTest({ kind: 'idle' });
                  }}
                  spellCheck={false}
                  required
                />
              </div>

              {test.kind === 'ok' && (
                <p className="text-sm text-teal" role="status">
                  ✓ Connected. The schema looks good.
                </p>
              )}
              {test.kind === 'error' && (
                <p className="text-sm text-amber-300" role="alert">
                  {test.reason}
                </p>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={handleTest}
                  disabled={!formReady || test.kind === 'testing'}
                >
                  {test.kind === 'testing' ? <Spinner /> : null}
                  Test connection
                </button>
              </div>
            </div>
          </li>

          <li>
            <div className="flex items-baseline gap-3 mb-2">
              <span className="font-mono text-xs text-teal">04</span>
              <h2 className="font-display text-lg font-medium text-white">
                Add a Groq API key <span className="text-slate-500 text-sm">(optional)</span>
              </h2>
            </div>
            <div className="pl-8 space-y-3">
              <p className="text-slate-400 text-sm leading-relaxed">
                Powers the AI that interviews you while creating tasks. Only admins and project
                leads need this — regular employees can skip it. Get a free key at{' '}
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-teal hover:underline"
                >
                  console.groq.com/keys
                </a>
                .
              </p>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                  Groq API key
                </label>
                <input
                  type="password"
                  className="input-base font-mono text-sm"
                  placeholder={
                    hasGroqKey
                      ? 'Already saved — leave blank to keep it'
                      : 'gsk_…'
                  }
                  value={groqKey}
                  onChange={(e) => setGroqKey(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
                {hasGroqKey && !groqKey && (
                  <p className="text-xs text-slate-500 mt-1.5">
                    A key is already saved on this Mac. Type a new one to replace it.
                  </p>
                )}
                {hasGroqKey && groqKey && (
                  <p className="text-xs text-amber-300 mt-1.5">
                    This will overwrite the key currently saved on this Mac.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={!formReady || saving || test.kind === 'testing'}
                >
                  {saving ? <Spinner /> : null}
                  Save &amp; continue
                </button>
                <span className="text-xs text-slate-500">
                  {formReady
                    ? 'Supabase config is valid — you can continue.'
                    : 'Fill in Supabase URL and anon key above first.'}
                </span>
              </div>
            </div>
          </li>
        </ol>
        </form>
      </motion.div>
    </div>
  );
}
