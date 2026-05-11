import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { motion } from 'framer-motion';
import { listTasksByProject } from '../../services/supabase/tasks';
import { listProjects } from '../../services/supabase/projects';
import { listClients } from '../../services/supabase/clients';
import { listUsers } from '../../services/supabase/users';
import { buildProjectAwareFlowchart } from '../../lib/projectAwareFlowchartLayout';
import type { EventNodeData } from '../../lib/flowchartLayout';
import type { Project, Task } from '../../domain/types';
import { toErrorMessage } from '../../lib/errors';
import { useAuth } from '../../auth/AuthContext';
import { EventNode } from './EventNode';
import { GroupHeaderNode } from './GroupHeaderNode';
import { useTaskActions } from './useTaskActions';
import { TaskActionLayer } from './TaskActionLayer';
import type { DrawerMode } from './TaskDrawer';
import { Spinner } from '../../ui/components/Spinner';
import { ListIcon } from '../../ui/components/Icon';

const nodeTypes = { event: EventNode, groupHeader: GroupHeaderNode };

interface Props {
  projectId: string;
}

/**
 * Project-scoped flowchart used by leads viewing their project. Loads every
 * task whose project_id === :projectId, groups them by assignee, and renders
 * one section per teammate. Drawer is in admin mode so the lead has full
 * project-scoped powers.
 */
export function ProjectFlowchartView({ projectId }: Props) {
  const { flowdeskUser } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectMap, setProjectMap] = useState<Map<string, Project>>(new Map());
  const [projects, setProjects] = useState<Map<string, string>>(new Map());
  const [clients, setClients] = useState<Map<string, string>>(new Map());
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [t, p, c, u] = await Promise.all([
        listTasksByProject(projectId),
        listProjects(),
        listClients(),
        listUsers(),
      ]);
      setTasks(t);
      setProjectMap(new Map(p.map((x) => [x.id, x])));
      setProjects(new Map(p.map((x) => [x.id, x.name])));
      setClients(new Map(c.map((x) => [x.id, x.name])));
      setUserNames(new Map(u.map((x) => [x.id, x.name])));
    } catch (e) {
      setLoadError(toErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const getTaskById = useCallback((id: string) => tasks.find((t) => t.id === id), [tasks]);
  const actions = useTaskActions({ refresh, getTaskById });

  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups((cur) => {
      const next = new Set(cur);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const toggleTaskExpand = useCallback((taskId: string) => {
    setExpandedTasks((cur) => {
      const next = new Set(cur);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const onOpenTaskFromHeader = useCallback(
    (taskId: string) => actions.setSelectedTaskId(taskId),
    [actions],
  );

  /**
   * Project-aware layout — shows the lead-task wrapper for tasks the lead
   * delegated, and a separate admin-direct branch for tasks the admin assigned
   * directly to teammates on this project.
   */
  const { nodes, edges } = useMemo(() => {
    return buildProjectAwareFlowchart({
      tasks,
      projects: projectMap,
      clientNames: clients,
      projectNames: projects,
      userNames,
      wrapWithClient: false,
      showProjectHeader: false, // page header already names the project
      collapsedGroupIds: collapsedGroups,
      expandedTaskIds: expandedTasks,
      onToggleGroup: toggleGroup,
      onToggleTaskExpand: toggleTaskExpand,
      onOpenTask: onOpenTaskFromHeader,
    });
  }, [
    tasks,
    projectMap,
    clients,
    projects,
    userNames,
    collapsedGroups,
    expandedTasks,
    toggleGroup,
    toggleTaskExpand,
    onOpenTaskFromHeader,
  ]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_evt, node) => {
      if (node.type !== 'event') return;
      const data = node.data as EventNodeData;
      actions.setSelectedTaskId(data.event.taskId);
    },
    [actions],
  );

  /**
   * The lead's "scoped admin powers" apply only to tasks they themselves
   * assigned. Tasks the admin assigned directly — even within this project —
   * stay under admin's responsibility, so the lead sees them as observer.
   */
  const drawerMode: DrawerMode = useMemo(() => {
    if (!actions.selectedTask || !flowdeskUser) return 'observer';
    return actions.selectedTask.assignerId === flowdeskUser.id ? 'admin' : 'observer';
  }, [actions.selectedTask, flowdeskUser]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <Spinner /> Loading project…
        </div>
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="h-full flex items-center justify-center px-6">
        <div className="max-w-md glass-card p-6 text-amber-300 text-sm">{loadError}</div>
      </div>
    );
  }
  if (tasks.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="h-full flex items-center justify-center px-6"
      >
        <div className="glass-card p-12 max-w-md text-center">
          <div className="w-12 h-12 rounded-2xl bg-teal/10 border border-teal/20 flex items-center justify-center text-teal mx-auto mb-4">
            <ListIcon size={22} />
          </div>
          <h2 className="font-display text-xl font-semibold text-white mb-1">
            No tasks in this project yet
          </h2>
          <p className="text-sm text-slate-400">
            Use <span className="text-teal">Assign new task</span> in the header to add one.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 relative">
        <ReactFlow
          nodes={nodes as Node[]}
          edges={edges as Edge[]}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.2, minZoom: 0.25, maxZoom: 1 }}
          minZoom={0.15}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
        >
          <Background gap={24} size={1} color="rgba(255,255,255,0.04)" />
          <Controls
            showInteractive={false}
            className="!bg-navy-900/80 !border !border-white/10 !rounded-xl !shadow-glass"
          />
          <MiniMap
            pannable
            zoomable
            nodeColor={(n) => (n.type === 'groupHeader' ? '#1d2c4d' : '#0c1424')}
            maskColor="rgba(8, 13, 26, 0.7)"
            className="!bg-navy-900/80 !border !border-white/10 !rounded-xl"
          />
        </ReactFlow>
      </div>

      <TaskActionLayer
        actions={actions}
        allTasks={tasks}
        projects={projects}
        clients={clients}
        userNames={userNames}
        mode={drawerMode}
      />
    </div>
  );
}
