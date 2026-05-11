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
import { listTasksByAssignee } from '../../services/supabase/tasks';
import { listProjects } from '../../services/supabase/projects';
import { listClients } from '../../services/supabase/clients';
import { listUsers } from '../../services/supabase/users';
import {
  buildFlowchart,
  hydrateNodeData,
  type EventNodeData,
} from '../../lib/flowchartLayout';
import type { Task } from '../../domain/types';
import { toErrorMessage } from '../../lib/errors';
import { EventNode } from './EventNode';
import { Toolbar, type StatusFilter } from './Toolbar';
import { Spinner } from '../../ui/components/Spinner';
import { ListIcon } from '../../ui/components/Icon';
import { useTaskActions } from './useTaskActions';
import { TaskActionLayer } from './TaskActionLayer';
import type { DrawerMode } from './TaskDrawer';

const nodeTypes = { event: EventNode };

interface Props {
  /** Whose tasks to render. */
  assigneeId: string;
  /** Display name shown in the empty-state copy. */
  assigneeName?: string;
  mode: DrawerMode;
}

export function TaskFlowchartView({ assigneeId, assigneeName, mode }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Map<string, string>>(new Map());
  const [clients, setClients] = useState<Map<string, string>>(new Map());
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showCompleted, setShowCompleted] = useState(false);
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const toggleTaskExpand = useCallback((taskId: string) => {
    setExpandedTasks((cur) => {
      const next = new Set(cur);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [t, p, c, u] = await Promise.all([
        listTasksByAssignee(assigneeId),
        listProjects(),
        listClients(),
        listUsers(),
      ]);
      setTasks(t);
      setProjects(new Map(p.map((x) => [x.id, x.name])));
      setClients(new Map(c.map((x) => [x.id, x.name])));
      setUserNames(new Map(u.map((x) => [x.id, x.name])));
    } catch (e) {
      setLoadError(toErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [assigneeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const getTaskById = useCallback((id: string) => tasks.find((t) => t.id === id), [tasks]);
  const actions = useTaskActions({ refresh, getTaskById });

  const visibleTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (!showCompleted && t.status === 'completed') return false;
      if (projectFilter && t.projectId !== projectFilter) return false;
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      return true;
    });
  }, [tasks, showCompleted, projectFilter, statusFilter]);

  const projectsForFilter = useMemo(
    () =>
      Array.from(new Set(tasks.map((t) => t.projectId).filter((id): id is string => Boolean(id))))
        .map((id) => ({ id, name: projects.get(id) ?? id }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [tasks, projects],
  );

  const { nodes, edges } = useMemo(() => {
    const built = buildFlowchart(visibleTasks, {
      expandedTaskIds: expandedTasks,
      onToggleExpand: toggleTaskExpand,
    });
    return {
      nodes: hydrateNodeData(built.nodes, projects, clients),
      edges: built.edges,
    };
  }, [visibleTasks, projects, clients, expandedTasks, toggleTaskExpand]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_evt, node) => {
      const data = node.data as EventNodeData;
      actions.setSelectedTaskId(data.event.taskId);
    },
    [actions],
  );

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <Spinner /> Loading tasks…
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
    return <EmptyState assigneeName={assigneeName} mode={mode} />;
  }

  return (
    <div className="h-full flex flex-col">
      <Toolbar
        showCompleted={showCompleted}
        onToggleCompleted={setShowCompleted}
        projectFilter={projectFilter}
        projectOptions={projectsForFilter}
        onProjectFilter={setProjectFilter}
        statusFilter={statusFilter}
        onStatusFilter={setStatusFilter}
        taskCount={visibleTasks.length}
      />

      <div className="flex-1 min-h-0 relative">
        <ReactFlow
          nodes={nodes as Node<EventNodeData>[]}
          edges={edges as Edge[]}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.25, minZoom: 0.4, maxZoom: 1.2 }}
          minZoom={0.25}
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
            nodeColor="#0c1424"
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
        mode={mode}
      />
    </div>
  );
}

function EmptyState({
  assigneeName,
  mode,
}: {
  assigneeName?: string;
  mode: DrawerMode;
}) {
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
        <h2 className="font-display text-xl font-semibold text-white mb-1">No tasks yet</h2>
        <p className="text-sm text-slate-400">
          {mode === 'admin'
            ? `${assigneeName ?? 'This employee'} hasn't been assigned any tasks yet.`
            : "When the admin assigns you a task, it'll appear here. Tasks queue one at a time — finish or mark them parallel to unlock the next."}
        </p>
      </div>
    </motion.div>
  );
}
