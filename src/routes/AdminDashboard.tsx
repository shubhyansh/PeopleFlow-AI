import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../auth/AuthContext';
import { ipc } from '../lib/ipc';
import { toErrorMessage } from '../lib/errors';
import { listUsers } from '../services/supabase/users';
import { listAllTasks } from '../services/supabase/tasks';
import { Spinner } from '../ui/components/Spinner';
import { ChatIcon, UsersIcon } from '../ui/components/Icon';
import { SparkleIcon } from '../ui/components/IconExtras';

export default function AdminDashboard() {
  const { flowdeskUser } = useAuth();
  const [pingResult, setPingResult] = useState<string | null>(null);
  const [pingBusy, setPingBusy] = useState(false);
  const [employeeCount, setEmployeeCount] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [activeTaskCount, setActiveTaskCount] = useState<number | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [users, tasks] = await Promise.all([listUsers(), listAllTasks()]);
        setEmployeeCount(users.length);
        setPendingCount(users.filter((u) => !u.passwordHash).length);
        setActiveTaskCount(
          tasks.filter((t) => t.status === 'active' || t.status === 'parallel').length,
        );
      } catch (e) {
        setStatsError(toErrorMessage(e));
      }
    })();
  }, []);

  async function pingGroq() {
    setPingBusy(true);
    try {
      const res = await ipc.groq.chat({ messages: [{ role: 'user', content: 'ping' }] });
      setPingResult(`${res.content}${res.stub ? ' (stub)' : ''}`);
    } catch (e) {
      setPingResult(toErrorMessage(e));
    } finally {
      setPingBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-10 max-w-6xl mx-auto"
    >
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="font-mono text-xs text-teal uppercase tracking-wider mb-1">Overview</p>
          <h1 className="font-display text-3xl font-semibold text-white">
            Welcome, {flowdeskUser?.name}
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            Pick an employee from the list to start a chat-driven task assignment.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/org" className="btn-ghost">
            <SparkleIcon size={16} />
            Org view
          </Link>
          <Link to="/admin/employees" className="btn-primary">
            <ChatIcon size={16} />
            Assign a task
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Employees" value={employeeCount} error={statsError} to="/admin/employees" />
        <StatCard
          label="Pending first login"
          value={pendingCount}
          error={statsError}
          to="/admin/employees"
        />
        <StatCard
          label="Active tasks"
          value={activeTaskCount}
          error={statsError}
          to="/admin/tasks"
        />
      </div>

      <div className="glass-card p-6">
        <h2 className="font-display text-lg font-semibold text-white mb-1">IPC bridge</h2>
        <p className="text-slate-400 text-sm mb-4">
          Round-trip a message through the Electron main process to confirm the Groq pipeline is live.
        </p>
        <div className="flex items-center gap-3">
          <button type="button" className="btn-ghost" onClick={pingGroq} disabled={pingBusy}>
            {pingBusy ? <Spinner /> : null}
            Ping Groq bridge
          </button>
          {pingResult && (
            <code className="font-mono text-xs text-slate-300 bg-navy-900 border border-white/10 rounded-lg px-3 py-2">
              {pingResult}
            </code>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function StatCard({
  label,
  value,
  error,
  to,
  disabled,
}: {
  label: string;
  value: number | null;
  error?: string | null;
  to?: string;
  disabled?: boolean;
}) {
  const content = (
    <div
      className={[
        'glass-card p-5 transition-colors',
        to ? 'hover:border-teal/30 cursor-pointer' : '',
        disabled ? 'opacity-50' : '',
      ].join(' ')}
    >
      <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wider mb-2">
        <UsersIcon size={14} />
        {label}
      </div>
      <div className="font-display text-3xl font-semibold text-white">
        {error ? <span className="text-amber-400 text-base">!</span> : value ?? '—'}
      </div>
      {disabled && <div className="text-xs text-slate-600 mt-1">coming soon</div>}
    </div>
  );

  return to ? <Link to={to}>{content}</Link> : content;
}
