import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import SetupScreen from './routes/SetupScreen';
import { AuthProvider } from './auth/AuthContext';
import { setSupabaseConfig } from './services/supabase/client';
import { ipc } from './lib/ipc';
import { Spinner } from './ui/components/Spinner';
import './styles/index.css';

function Boot() {
  const [stage, setStage] = useState<'loading' | 'setup' | 'ready'>('loading');
  const [existing, setExisting] = useState<{ url: string; anonKey: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await ipc.config.getSupabase();
        if (cfg) {
          setSupabaseConfig(cfg);
          setStage('ready');
          return;
        }
      } catch {
        // fall through to setup
      }
      // Dev nicety: if .env has VITE_SUPABASE_* values, pre-fill the setup
      // form so the dev doesn't retype on a fresh userData folder.
      const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
      setExisting(envUrl && envKey ? { url: envUrl, anonKey: envKey } : null);
      setStage('setup');
    })();
  }, []);

  if (stage === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400 gap-3">
        <Spinner /> Loading FlowDesk…
      </div>
    );
  }

  if (stage === 'setup') {
    return (
      <SetupScreen initialConfig={existing} onConfigured={() => setStage('ready')} />
    );
  }

  return (
    <HashRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </HashRouter>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <Boot />
  </React.StrictMode>,
);
