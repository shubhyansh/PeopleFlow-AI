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
import type { Project, Task, TaskStatus } from '../../domain/types';
import { listAllTasks } from '../../services/supabase/tasks';
import { listProjects } from '../../services/supabase/projects';
import { listClients } from '../../services/supabase/clients';
import { listUsers } from '../../services/supabase/users';
import { buildLeveledFlowchart } from '../../lib/leveledFlowchartLayout';
import { buildProjectAwareFlowchart } from '../../lib/projectAwareFlowchartLayout';
import { EventNode } from '../../components/flowchart/EventNode';
import { GroupHeaderNode } from '../../components/flowchart/GroupHeaderNode';
import { useTaskActions } from '../../components/flowchart/useTaskActions';
import { TaskActionLayer } from '../../components/flowchart/TaskActionLayer';
import type { EventNodeData } from '../../lib/flowchartLayout';
import { toErrorMessage } from '../../lib/errors';
import { STATUS_STYLES } from '../../components/flowchart/statusStyles';
import { Spinner } from '../../ui/components/Spinner';
import { ListIcon, SearchIcon } from '../../ui/components/Icon';

const nodeTypes = { event: EventNode, groupHeader: GroupHeaderNode };

type GroupBy = 'person' | 'project' | 'client' | 'hierarchy';
type StatusFilter = 'all' | TaskStatus;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  ...(Object.keys(STATUS_STYLES) as TaskStatus[]).map((s) => ({
    value: s as StatusFilter,
    label: STATUS_STYLES[s].label,
  })),
];

export default function Org() {
  const [tasks, setTasks] = useState<Task[]>([]);
  /** Full project objects so the layout can read project.leadId for the lead/admin-direct branching. */
  const [projectMap, setProjectMap] = useState<Map<string, Project>>(new Map());
  const [projects, setProjects] = useState<Map<string, string>>(new Map());
  const [clients, setClients] = useState<Map<string, string>>(new Map());
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [groupBy, setGroupBy] = useState<GroupBy>('person');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [t, p, c, u] = await Promise.all([
        listAllTasks(),
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
  }, []);

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

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (!showCompleted && t.status === 'completed') return false;
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (!q) return true;
      const title = t.title.toLowerCase();
      const assignee = userNames.get(t.assigneeId)?.toLowerCase() ?? '';
      const project = t.projectId ? (projects.get(t.projectId) ?? '').toLowerCase() : '';
      return title.includes(q) || assignee.includes(q) || project.includes(q);
    });
  }, [tasks, showCompleted, statusFilter, search, userNames, projects]);

  /**
   * Person view stays simple (1-level by assignee). The other three modes use
   * the project-aware layout so each project shows the lead-task wrapper for
   * tasks the lead delegated, plus a separate admin-direct branch for tasks
   * admin assigned bypassing the lead.
   */
  const topLevelGroupCount = useMemo(() => {
    if (filteredTasks.length === 0) return 0;
    const seen = new Set<string>();
    for (const t of filteredTasks) {
      const key =
        groupBy === 'person'
          ? t.assigneeId
          : groupBy === 'project'
          ? t.projectId ?? '__no_project__'
          : t.clientId ?? '__no_client__';
      seen.add(key);
    }
    return seen.size;
  }, [filteredTasks, groupBy]);

  const onOpenTaskFromHeader = useCallback(
    (taskId: string) => actions.setSelectedTaskId(taskId),
    [actions],
  );

  const { nodes, edges } = useMemo(() => {
    if (groupBy === 'person') {
      return buildLeveledFlowchart({
        tasks: filteredTasks,
        levels: ['assignee'],
        clients,
        projects,
        users: userNames,
        collapsedGroupIds: collapsedGroups,
        expandedTaskIds: expandedTasks,
        onToggleGroup: toggleGroup,
        onToggleTaskExpand: toggleTaskExpand,
      });
    }
    return buildProjectAwareFlowchart({
      tasks: filteredTasks,
      projects: projectMap,
      clientNames: clients,
      projectNames: projects,
      userNames,
      wrapWithClient: groupBy === 'client' || groupBy === 'hierarchy',
      showProjectHeader: true,
      collapsedGroupIds: collapsedGroups,
      expandedTaskIds: expandedTasks,
      onToggleGroup: toggleGroup,
      onToggleTaskExpand: toggleTaskExpand,
      onOpenTask: onOpenTaskFromHeader,
    });
  }, [
    groupBy,
    filteredTasks,
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

  return (
    <div className="h-full flex flex-col">
      <Toolbar
        groupBy={groupBy}
        onGroupBy={setGroupBy}
        search={search}
        onSearch={setSearch}
        statusFilter={statusFilter}
        onStatusFilter={setStatusFilter}
        showCompleted={showCompleted}
        onToggleCompleted={setShowCompleted}
        groupCount={topLevelGroupCount}
        taskCount={filteredTasks.length}
      />

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-3 text-slate-400">
            <Spinner /> Loading org…
          </div>
        </div>
      ) : loadError ? (
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-md glass-card p-6 text-amber-300 text-sm">{loadError}</div>
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState />
      ) : filteredTasks.length === 0 ? (
        <NoMatches />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="flex-1 min-h-0 relative"
        >
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
        </motion.div>
      )}

      <TaskActionLayer
        actions={actions}
        allTasks={tasks}
        projects={projects}
        clients={clients}
        userNames={userNames}
        mode="admin"
      />
    </div>
  );
}

// ---------- Toolbar ----------

function Toolbar({
  groupBy,
  onGroupBy,
  search,
  onSearch,
  statusFilter,
  onStatusFilter,
  showCompleted,
  onToggleCompleted,
  groupCount,
  taskCount,
}: {
  groupBy: GroupBy;
  onGroupBy: (g: GroupBy) => void;
  search: string;
  onSearch: (s: string) => void;
  statusFilter: StatusFilter;
  onStatusFilter: (s: StatusFilter) => void;
  showCompleted: boolean;
  onToggleCompleted: (next: boolean) => void;
  groupCount: number;
  taskCount: number;
}) {
  return (
    <div className="shrink-0 flex flex-wrap items-center gap-3 px-6 py-3 border-b border-white/5 bg-navy-900/50 backdrop-blur-sm">
      <div className="flex flex-col mr-2">
        <span className="font-mono text-[10px] text-teal uppercase tracking-wider">Org view</span>
        <span className="font-mono text-xs text-slate-500">
          {groupCount} {topLevelLabel(groupBy, groupCount)} · {taskCount} task
          {taskCount === 1 ? '' : 's'}
        </span>
      </div>

      <div className="h-6 w-px bg-white/10" />

      <div className="flex gap-1 p-1 rounded-xl border border-white/10 bg-navy-900/60">
        {(
          [
            { value: 'person', label: 'By person' },
            { value: 'project', label: 'By project' },
            { value: 'client', label: 'By client' },
            { value: 'hierarchy', label: 'Full hierarchy' },
          ] as { value: GroupBy; label: string }[]
        ).map((g) => (
          <button
            key={g.value}
            type="button"
            onClick={() => onGroupBy(g.value)}
            className={[
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              groupBy === g.value
                ? 'bg-teal/15 text-teal'
                : 'text-slate-400 hover:text-slate-200',
            ].join(' ')}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className="relative flex-1 max-w-sm">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
          <SearchIcon size={14} />
        </span>
        <input
          type="text"
          className="input-base pl-8 !py-1.5 !text-sm"
          placeholder="Search tasks, assignees, projects…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Status</span>
        <select
          className="input-base !py-1.5 !px-3 !text-xs w-36"
          value={statusFilter}
          onChange={(e) => onStatusFilter(e.target.value as StatusFilter)}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
        <input
          type="checkbox"
          className="accent-teal"
          checked={showCompleted}
          onChange={(e) => onToggleCompleted(e.target.checked)}
        />
        Show completed
      </label>
    </div>
  );
}

function topLevelLabel(groupBy: GroupBy, n: number): string {
  switch (groupBy) {
    case 'person':
      return n === 1 ? 'person' : 'people';
    case 'project':
      return n === 1 ? 'project' : 'projects';
    case 'client':
    case 'hierarchy':
      return n === 1 ? 'client' : 'clients';
  }
}

// ---------- Empty / no-match states ----------

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="glass-card p-12 max-w-md text-center">
        <div className="w-12 h-12 rounded-2xl bg-teal/10 border border-teal/20 flex items-center justify-center text-teal mx-auto mb-4">
          <ListIcon size={22} />
        </div>
        <h2 className="font-display text-xl font-semibold text-white mb-1">No tasks across the org</h2>
        <p className="text-sm text-slate-400">
          Once you assign tasks from the Employees page, they'll all show up here grouped by person
          or project.
        </p>
      </div>
    </div>
  );
}

function NoMatches() {
  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="glass-card p-10 max-w-md text-center">
        <h3 className="font-display text-lg text-white mb-1">No matches</h3>
        <p className="text-sm text-slate-400">Try clearing the search or status filter.</p>
      </div>
    </div>
  );
}
