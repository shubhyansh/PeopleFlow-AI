import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../auth/AuthContext';
import { getProject } from '../../services/supabase/projects';
import { listClients } from '../../services/supabase/clients';
import { toErrorMessage } from '../../lib/errors';
import type { Project } from '../../domain/types';
import { ProjectFlowchartView } from '../../components/flowchart/ProjectFlowchartView';
import { ProjectSettings } from '../../components/projects/ProjectSettings';
import { Spinner } from '../../ui/components/Spinner';
import { ChatIcon, ChevronLeftIcon } from '../../ui/components/Icon';

export default function ProjectLeadView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { flowdeskUser } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [clientName, setClientName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshProject = useCallback(async () => {
    if (!id) return;
    try {
      const [proj, clients] = await Promise.all([getProject(id), listClients()]);
      setProject(proj);
      if (proj?.clientId) {
        setClientName(clients.find((c) => c.id === proj.clientId)?.name ?? '');
      }
    } catch (e) {
      setError(toErrorMessage(e));
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    void refreshProject().finally(() => setLoading(false));
  }, [id, refreshProject]);

  if (!id) return null;

  // Refuse access if the signed-in employee isn't the lead of this project.
  const isLead = project && flowdeskUser && project.leadId === flowdeskUser.id;

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/employee')}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
        >
          <ChevronLeftIcon size={16} />
          My tasks
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-xs text-teal uppercase tracking-wider">Project lead</span>
          {project && (
            <>
              <span className="text-slate-600">·</span>
              <span className="text-sm text-slate-200 truncate">{project.name}</span>
              {clientName && (
                <span className="font-mono text-[11px] text-slate-500">— {clientName}</span>
              )}
            </>
          )}
        </div>

        {isLead ? (
          <Link to={`/employee/projects/${id}/assign`} className="btn-primary !py-2 !text-sm">
            <ChatIcon size={14} />
            Assign new task
          </Link>
        ) : (
          <div className="w-32" />
        )}
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-slate-400">
            <Spinner /> Loading project…
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-md glass-card p-6 text-amber-300 text-sm">{error}</div>
        </div>
      )}

      {!loading && !error && !project && (
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-md glass-card p-6 text-amber-300 text-sm">Project not found.</div>
        </div>
      )}

      {!loading && !error && project && !isLead && (
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-md glass-card p-6 text-amber-300 text-sm">
            You are not the lead of this project, so you can't manage it. Speak to the admin if this
            is unexpected.
          </div>
        </div>
      )}

      {!loading && !error && project && isLead && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="flex-1 min-h-0 flex flex-col"
        >
          <div className="px-6 pt-4 pb-2">
            <ProjectSettings project={project} mode="lead" onChanged={refreshProject} />
          </div>
          <div className="flex-1 min-h-0">
            <ProjectFlowchartView projectId={id} />
          </div>
        </motion.div>
      )}
    </div>
  );
}
