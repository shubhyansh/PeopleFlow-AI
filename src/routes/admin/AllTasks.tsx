import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { Task, User } from '../../domain/types';
import { listAllTasks } from '../../services/supabase/tasks';
import { listProjects } from '../../services/supabase/projects';
import { listClients } from '../../services/supabase/clients';
import { listUsers } from '../../services/supabase/users';
import { useAuth } from '../../auth/AuthContext';
import { addRequirements } from '../../lib/taskLifecycle';
import { toErrorMessage } from '../../lib/errors';
import { TaskDrawer } from '../../components/flowchart/TaskDrawer';
import { NoteModal } from '../../components/flowchart/NoteModal';
import { statusOf } from '../../components/flowchart/statusStyles';
import { Spinner } from '../../ui/components/Spinner';
import { ChatIcon, ListIcon, PlusIcon, SearchIcon } from '../../ui/components/Icon';

export default function AllTasks() {
  const navigate = useNavigate();
  const { flowdeskUser } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Map<string, string>>(new Map());
  const [clients, setClients] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reqOpen, setReqOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [t, u, p, c] = await Promise.all([
        listAllTasks(),
        listUsers(),
        listProjects(),
        listClients(),
      ]);
      setTasks(t);
      setUsers(u);
      setProjects(new Map(p.map((x) => [x.id, x.name])));
      setClients(new Map(c.map((x) => [x.id, x.name])));
    } catch (e) {
      setLoadError(toErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const userNames = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);

  // Group tasks by assignee, apply search
  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = tasks.filter((t) => {
      if (!q) return true;
      const title = t.title.toLowerCase();
      const assigneeName = userNames.get(t.assigneeId)?.toLowerCase() ?? '';
      const projectName = t.projectId ? (projects.get(t.projectId) ?? '').toLowerCase() : '';
      return title.includes(q) || assigneeName.includes(q) || projectName.includes(q);
    });
    const map = new Map<string, Task[]>();
    filtered.forEach((t) => {
      if (!map.has(t.assigneeId)) map.set(t.assigneeId, []);
      map.get(t.assigneeId)!.push(t);
    });
    // Sort each group by sequence, then sort groups by assignee name
    const result = Array.from(map.entries())
      .map(([assigneeId, ts]) => ({
        assigneeId,
        assigneeName: userNames.get(assigneeId) ?? '(unknown)',
        tasks: ts.sort((a, b) => a.sequenceIndex - b.sequenceIndex),
      }))
      .sort((a, b) => a.assigneeName.localeCompare(b.assigneeName));
    return result;
  }, [tasks, search, userNames, projects]);

  const selectedTask = useMemo(
    () => (selectedId ? tasks.find((t) => t.id === selectedId) ?? null : null),
    [selectedId, tasks],
  );

  const handleAddRequirements = useCallback(
    async (note: string) => {
      if (!selectedTask || !flowdeskUser) return;
      await addRequirements(selectedTask, note, flowdeskUser.id);
      await refresh();
    },
    [selectedTask, flowdeskUser, refresh],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-10 max-w-6xl mx-auto"
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="font-mono text-xs text-teal uppercase tracking-wider mb-1">Tasks</p>
          <h1 className="font-display text-3xl font-semibold text-white">All assignments</h1>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => navigate('/admin/employees')}
        >
          <ChatIcon size={16} />
          Assign new task
        </button>
      </div>
      <p className="text-slate-400 text-sm mb-8">
        Every task you've assigned, grouped by employee. Click any task to inspect, or add new
        requirements post-assignment.
      </p>

      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
            <SearchIcon size={16} />
          </span>
          <input
            type="text"
            className="input-base pl-9"
            placeholder="Search tasks, assignees, projects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="glass-card p-12 flex items-center justify-center gap-3 text-slate-400">
          <Spinner /> Loading tasks…
        </div>
      ) : loadError ? (
        <div className="px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-sm">
          {loadError}
        </div>
      ) : grouped.length === 0 ? (
        <div className="glass-card p-12 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-teal/10 border border-teal/20 flex items-center justify-center text-teal mb-4">
            <ListIcon size={22} />
          </div>
          <h3 className="font-display text-lg font-semibold text-white mb-1">
            {search ? 'No matches' : 'No tasks yet'}
          </h3>
          <p className="text-sm text-slate-400 mb-5 max-w-sm">
            {search
              ? 'Try a different search term.'
              : 'Assign your first task from the Employees page.'}
          </p>
          {!search && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => navigate('/admin/employees')}
            >
              <PlusIcon size={16} />
              Go to Employees
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.assigneeId} className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="font-display text-lg font-semibold text-white">
                    {group.assigneeName}
                  </h2>
                  <span className="font-mono text-xs text-slate-500">
                    {group.tasks.length} task{group.tasks.length === 1 ? '' : 's'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/admin/employees/${group.assigneeId}/flowchart`)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-teal hover:bg-teal/10 border border-teal/20 transition-colors"
                >
                  <ListIcon size={13} />
                  View flowchart
                </button>
              </div>
              <ul className="space-y-2">
                {group.tasks.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    projectName={t.projectId ? projects.get(t.projectId) ?? '' : ''}
                    onClick={() => setSelectedId(t.id)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <TaskDrawer
        open={selectedId !== null && selectedTask !== null}
        task={selectedTask}
        projectName={
          selectedTask?.projectId ? projects.get(selectedTask.projectId) ?? '' : ''
        }
        clientName={selectedTask?.clientId ? clients.get(selectedTask.clientId) ?? '' : ''}
        locked={false}
        mode="admin"
        userNames={userNames}
        onClose={() => setSelectedId(null)}
        onAddRequirements={() => setReqOpen(true)}
      />

      <NoteModal
        open={reqOpen}
        title="Add new requirements"
        description="The brief will be extended (not replaced). The assignee's task will be flagged purple until they acknowledge."
        placeholder="What's changed or been added to the scope?"
        confirmLabel="Add requirements"
        confirmClass="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 bg-purple-500/90 text-white font-semibold transition-colors hover:bg-purple-500 active:scale-[0.98] disabled:opacity-50"
        onClose={() => setReqOpen(false)}
        onSubmit={handleAddRequirements}
      />
    </motion.div>
  );
}

function TaskRow({
  task,
  projectName,
  onClick,
}: {
  task: Task;
  projectName: string;
  onClick: () => void;
}) {
  const status = statusOf(task.status);
  const remaining =
    task.deadline !== undefined
      ? Math.ceil((new Date(task.deadline).getTime() - Date.now()) / 86400000)
      : null;

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border border-white/5 bg-navy-950/40 hover:bg-white/[0.03] hover:border-teal/20 transition-colors text-left"
      >
        <span className={`pill ${status.pillClasses} shrink-0`}>
          <span
            className="w-1.5 h-1.5 rounded-full inline-block"
            style={{ backgroundColor: status.dot }}
          />
          {status.label}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-white truncate">{task.title}</div>
          <div className="font-mono text-[11px] text-slate-500 mt-0.5">
            #{task.sequenceIndex}
            {projectName ? ` · ${projectName}` : ''}
            {' · '}
            {new Date(task.createdAt).toLocaleDateString()}
          </div>
        </div>
        {remaining !== null && (
          <span
            className={[
              'font-mono text-xs shrink-0',
              remaining < 0
                ? 'text-red-400'
                : remaining <= 1
                ? 'text-amber-400'
                : 'text-slate-400',
            ].join(' ')}
          >
            {remaining < 0
              ? `${Math.abs(remaining)}d overdue`
              : remaining === 0
              ? 'due today'
              : `${remaining}d left`}
          </span>
        )}
      </button>
    </li>
  );
}
