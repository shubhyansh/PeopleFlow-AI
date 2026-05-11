import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TaskFlowchartView } from '../../components/flowchart/TaskFlowchartView';
import { getUserByUsername, listUsers } from '../../services/supabase/users';
import type { User } from '../../domain/types';
import { toErrorMessage } from '../../lib/errors';
import { ChevronLeftIcon } from '../../ui/components/Icon';
import { Spinner } from '../../ui/components/Spinner';

export default function EmployeeFlowchart() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<User | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        // We don't have getUserById; do a quick listUsers lookup so we can show the name.
        const users = await listUsers();
        const found = users.find((u) => u.id === id) ?? null;
        if (!found) {
          // Fallback: try the username route
          const byUsername = await getUserByUsername(id);
          setEmployee(byUsername);
        } else {
          setEmployee(found);
        }
      } catch (e) {
        setLoadError(toErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (!id) {
    return null;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
        >
          <ChevronLeftIcon size={16} />
          Back
        </button>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-teal uppercase tracking-wider">
            Employee flowchart
          </span>
          {employee && (
            <>
              <span className="text-slate-600">·</span>
              <span className="text-sm text-slate-200">{employee.name}</span>
              <span className="font-mono text-[11px] text-slate-500">@{employee.username}</span>
            </>
          )}
        </div>
        <div className="w-16" /> {/* spacer for symmetry */}
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-slate-400">
            <Spinner /> Loading…
          </div>
        </div>
      )}
      {loadError && !loading && (
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-md glass-card p-6 text-amber-300 text-sm">{loadError}</div>
        </div>
      )}
      {!loading && !loadError && employee && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="flex-1 min-h-0"
        >
          <TaskFlowchartView assigneeId={employee.id} assigneeName={employee.name} mode="admin" />
        </motion.div>
      )}
    </div>
  );
}
