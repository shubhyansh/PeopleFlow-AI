import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { Client, Project, User } from '../../domain/types';
import { listProjects } from '../../services/supabase/projects';
import { listClients } from '../../services/supabase/clients';
import { listUsers } from '../../services/supabase/users';
import { ProjectSettings } from '../../components/projects/ProjectSettings';
import { toErrorMessage } from '../../lib/errors';
import { Spinner } from '../../ui/components/Spinner';
import { FolderIcon, SearchIcon } from '../../ui/components/Icon';

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const [p, c, u] = await Promise.all([listProjects(), listClients(), listUsers()]);
      setProjects(p);
      setClients(c);
      setUsers(u);
    } catch (e) {
      setLoadError(toErrorMessage(e));
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients]);
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => {
      if (p.name.toLowerCase().includes(q)) return true;
      const client = p.clientId ? clientById.get(p.clientId)?.toLowerCase() ?? '' : '';
      if (client.includes(q)) return true;
      const lead = p.leadId ? userById.get(p.leadId)?.name.toLowerCase() ?? '' : '';
      if (lead.includes(q)) return true;
      return false;
    });
  }, [projects, search, clientById, userById]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-10 max-w-6xl mx-auto"
    >
      <div className="mb-2">
        <p className="font-mono text-xs text-teal uppercase tracking-wider mb-1">Projects</p>
        <h1 className="font-display text-3xl font-semibold text-white">All projects</h1>
      </div>
      <p className="text-slate-400 text-sm mb-8">
        Manage team rosters and transfer leadership. Projects are created when you assign their first
        task, so this list mirrors what's been assigned.
      </p>

      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
            <SearchIcon size={16} />
          </span>
          <input
            type="text"
            className="input-base pl-9"
            placeholder="Search by project, client, or lead…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="glass-card p-12 flex items-center justify-center gap-3 text-slate-400">
          <Spinner /> Loading projects…
        </div>
      ) : loadError ? (
        <div className="px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-sm">
          {loadError}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState hasFilter={projects.length > 0} />
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => {
            const lead = p.leadId ? userById.get(p.leadId) ?? null : null;
            const client = p.clientId ? clientById.get(p.clientId) ?? '' : '';
            return (
              <ProjectRow
                key={p.id}
                project={p}
                clientName={client}
                leadName={lead?.name ?? null}
                onRefresh={refresh}
              />
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

function ProjectRow({
  project,
  clientName,
  leadName,
  onRefresh,
}: {
  project: Project;
  clientName: string;
  leadName: string | null;
  onRefresh: () => Promise<void>;
}) {
  return (
    <div className="space-y-2">
      <div className="px-4 py-3 rounded-xl border border-white/10 bg-navy-950/40 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="font-display text-base font-semibold text-white truncate">
            {project.name}
          </div>
          <div className="font-mono text-[11px] text-slate-500 mt-0.5 truncate">
            {clientName ? `${clientName} · ` : ''}
            {leadName ? `Lead: ${leadName}` : 'No lead'} · {project.memberIds.length} member
            {project.memberIds.length === 1 ? '' : 's'}
          </div>
        </div>
        <span className="font-mono text-[10px] text-slate-600 truncate">{project.id}</span>
      </div>
      <ProjectSettings project={project} mode="admin" onChanged={onRefresh} />
    </div>
  );
}

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="glass-card p-12 flex flex-col items-center text-center">
      <div className="w-12 h-12 rounded-2xl bg-teal/10 border border-teal/20 flex items-center justify-center text-teal mb-4">
        <FolderIcon size={22} />
      </div>
      <h3 className="font-display text-lg font-semibold text-white mb-1">
        {hasFilter ? 'No matches' : 'No projects yet'}
      </h3>
      <p className="text-sm text-slate-400 max-w-sm">
        {hasFilter
          ? 'Try a different search term.'
          : 'Projects appear here as soon as you assign their first task. Use the chat assistant on the Employees page to start one.'}
      </p>
    </div>
  );
}
