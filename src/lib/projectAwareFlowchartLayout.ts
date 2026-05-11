import type { Edge, Node } from 'reactflow';
import type { Project, Task } from '../domain/types';
import { buildFlowchart, hydrateNodeData, type EventNodeData } from './flowchartLayout';
import type { GroupHeaderData } from '../components/flowchart/GroupHeaderNode';

interface BuildOpts {
  tasks: Task[];
  projects: Map<string, Project>;
  clientNames: Map<string, string>;
  projectNames: Map<string, string>;
  userNames: Map<string, string>;
  /** When true, wraps everything under client headers (top-level row of clients). */
  wrapWithClient: boolean;
  /** When false, omits the project header itself (used by the lead's project view, which has its own page header). */
  showProjectHeader: boolean;
  collapsedGroupIds: Set<string>;
  expandedTaskIds: Set<string>;
  onToggleGroup: (id: string) => void;
  onToggleTaskExpand: (taskId: string) => void;
  /** Selecting the lead-task header opens this task in the drawer. */
  onOpenTask: (taskId: string) => void;
}

const ROW_HEIGHT = 70;
const ROW_GAP = 24;
const TASKS_BELOW_PADDING = 30;
const X_GAP_CLIENT = 140;
const X_GAP_PROJECT = 90;
const X_GAP_BRANCH = 60; // gap between lead-domain and admin-direct
const X_GAP_ASSIGNEE = 40;
const MIN_CLIENT_WIDTH = 480;
const MIN_PROJECT_WIDTH = 420;
const MIN_BRANCH_WIDTH = 380;
const MIN_ASSIGNEE_WIDTH = 360;

const NO_CLIENT = '__no_client__';
const NO_PROJECT = '__no_project__';

// ---------- IDs for collapsable groups ----------
const idClient = (c: string) => `client:${c}`;
const idProject = (c: string, p: string) => `project:${c}|${p}`;
const idLeadDomain = (c: string, p: string) => `lead:${c}|${p}`;
const idAdminDirect = (c: string, p: string) => `admin:${c}|${p}`;
const idAssignee = (c: string, p: string, branch: string, a: string) =>
  `asn:${c}|${p}|${branch}|${a}`;

interface AssigneeNode {
  assigneeId: string;
  /** Stable id used as the React Flow node id + collapse-state key. */
  groupId: string;
  label: string;
  collapsed: boolean;
  width: number;
  taskSub: ReturnType<typeof buildFlowchart>;
}

interface BranchNode {
  kind: 'lead' | 'admin-direct';
  groupId: string;
  /** For lead branch: the leadership task itself (if found). */
  leadTask: Task | null;
  leadName?: string;
  collapsed: boolean;
  width: number;
  assignees: AssigneeNode[];
  taskCount: number;
}

interface ProjectNode {
  projectId: string;
  label: string;
  groupId: string;
  collapsed: boolean;
  width: number;
  branches: BranchNode[];
  taskCount: number;
}

interface ClientNode {
  clientId: string;
  label: string;
  groupId: string;
  collapsed: boolean;
  width: number;
  projects: ProjectNode[];
  taskCount: number;
}

/**
 * Builds a flowchart with project-aware lead/admin-direct branching.
 *
 * Hierarchy when fully expanded:
 *
 *   [Client]
 *     [Project]
 *       [LEAD TASK header — title of the leadership task, click to open]
 *         [Assignee 1]   [Assignee 2]   …    ← tasks the lead delegated
 *           tasks            tasks
 *       [ADMIN-DIRECT header]
 *         [Assignee A]   [Assignee B]   …    ← tasks admin assigned directly
 *           tasks            tasks
 *
 * If `wrapWithClient` is false, the Client level is skipped (used by "By project" mode).
 * If `showProjectHeader` is false, the Project header itself is skipped — used by the
 * lead's single-project page where the page already names the project.
 *
 * Tasks with no projectId fall under a "No project" pseudo-project. Inside a project
 * with no lead, only the admin-direct branch shows (no lead-task wrapper).
 */
export function buildProjectAwareFlowchart(opts: BuildOpts): {
  nodes: Node[];
  edges: Edge[];
} {
  // ---- Bucket: clientId → projectId → tasks ----
  const tree = bucketize(opts);
  // Measure widths bottom-up
  measureWidths(tree);

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  if (opts.wrapWithClient) {
    let xCursor = 0;
    for (const c of tree) {
      emitClient(c, xCursor, 0, opts, nodes, edges);
      xCursor += c.width + X_GAP_CLIENT;
    }
  } else {
    // Without client wrapping, lift each project to the top level.
    let xCursor = 0;
    for (const c of tree) {
      for (const p of c.projects) {
        if (opts.showProjectHeader) {
          emitProject(p, xCursor, 0, opts, nodes, edges);
        } else {
          // Skip project header — emit branches at the top level.
          let bxCursor = xCursor;
          for (const b of p.branches) {
            emitBranch(b, bxCursor, 0, opts, nodes, edges);
            bxCursor += b.width + X_GAP_BRANCH;
          }
        }
        xCursor += p.width + X_GAP_PROJECT;
      }
    }
  }

  return { nodes, edges };
}

// ---------- Bucketing ----------

function bucketize(opts: BuildOpts): ClientNode[] {
  const { tasks, projects, clientNames, projectNames, userNames } = opts;

  // First, group by client id
  const byClient = new Map<string, Task[]>();
  for (const t of tasks) {
    const c = t.clientId ?? NO_CLIENT;
    if (!byClient.has(c)) byClient.set(c, []);
    byClient.get(c)!.push(t);
  }

  const sortedClientIds = Array.from(byClient.keys()).sort((a, b) => {
    if (a === NO_CLIENT) return 1;
    if (b === NO_CLIENT) return -1;
    return (clientNames.get(a) ?? a).localeCompare(clientNames.get(b) ?? b);
  });

  return sortedClientIds.map((clientId) => {
    const clientTasks = byClient.get(clientId)!;

    // Group this client's tasks by project
    const byProject = new Map<string, Task[]>();
    for (const t of clientTasks) {
      const p = t.projectId ?? NO_PROJECT;
      if (!byProject.has(p)) byProject.set(p, []);
      byProject.get(p)!.push(t);
    }

    const sortedProjectIds = Array.from(byProject.keys()).sort((a, b) => {
      if (a === NO_PROJECT) return 1;
      if (b === NO_PROJECT) return -1;
      return (projectNames.get(a) ?? a).localeCompare(projectNames.get(b) ?? b);
    });

    const projectNodes: ProjectNode[] = sortedProjectIds.map((projectId) => {
      const projectTasks = byProject.get(projectId)!;
      const project = projectId !== NO_PROJECT ? projects.get(projectId) ?? null : null;
      const leadId = project?.leadId ?? null;

      // Find the leadership task (admin-assigned, type=leadership, assignee=leadId)
      const leadTask =
        leadId &&
        (projectTasks.find(
          (t) =>
            t.type === 'leadership' &&
            t.assigneeId === leadId &&
            t.assignerId === 'admin',
        ) ?? null);

      // Bucket non-leadership tasks
      const leadDomainTasks: Task[] = [];
      const adminDirectTasks: Task[] = [];

      for (const t of projectTasks) {
        if (leadTask && t.id === leadTask.id) continue; // exclude the leadership task itself
        if (leadId && t.assignerId === leadId) {
          leadDomainTasks.push(t);
        } else {
          // Admin-assigned (or any non-lead assigner)
          adminDirectTasks.push(t);
        }
      }

      const branches: BranchNode[] = [];

      if (leadId) {
        // Lead branch (always shows when project has a lead, even if delegations are empty)
        const leadBranch = buildBranch(
          'lead',
          clientId,
          projectId,
          leadDomainTasks,
          opts,
          leadTask || null,
          leadId ? userNames.get(leadId) ?? leadId : undefined,
        );
        branches.push(leadBranch);
      }

      if (adminDirectTasks.length > 0 || (!leadId && projectTasks.length > 0)) {
        const adminBranch = buildBranch(
          'admin-direct',
          clientId,
          projectId,
          adminDirectTasks,
          opts,
          null,
          undefined,
        );
        branches.push(adminBranch);
      }

      const totalTaskCount = projectTasks.length;

      return {
        projectId,
        label:
          projectId === NO_PROJECT
            ? 'No project'
            : projectNames.get(projectId) ?? '(unknown project)',
        groupId: idProject(clientId, projectId),
        collapsed: opts.collapsedGroupIds.has(idProject(clientId, projectId)),
        width: 0, // measured later
        branches,
        taskCount: totalTaskCount,
      };
    });

    return {
      clientId,
      label:
        clientId === NO_CLIENT ? 'No client' : clientNames.get(clientId) ?? '(unknown client)',
      groupId: idClient(clientId),
      collapsed: opts.collapsedGroupIds.has(idClient(clientId)),
      width: 0,
      projects: projectNodes,
      taskCount: projectNodes.reduce((s, p) => s + p.taskCount, 0),
    };
  });
}

function buildBranch(
  kind: 'lead' | 'admin-direct',
  clientId: string,
  projectId: string,
  branchTasks: Task[],
  opts: BuildOpts,
  leadTask: Task | null,
  leadName: string | undefined,
): BranchNode {
  const groupId = kind === 'lead' ? idLeadDomain(clientId, projectId) : idAdminDirect(clientId, projectId);
  const collapsed = opts.collapsedGroupIds.has(groupId);

  // Group branch tasks by assignee
  const byAssignee = new Map<string, Task[]>();
  for (const t of branchTasks) {
    if (!byAssignee.has(t.assigneeId)) byAssignee.set(t.assigneeId, []);
    byAssignee.get(t.assigneeId)!.push(t);
  }

  const sortedAssigneeIds = Array.from(byAssignee.keys()).sort((a, b) =>
    (opts.userNames.get(a) ?? a).localeCompare(opts.userNames.get(b) ?? b),
  );

  const assignees: AssigneeNode[] = sortedAssigneeIds.map((assigneeId) => {
    const ts = byAssignee.get(assigneeId)!.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const aGroupId = idAssignee(clientId, projectId, kind, assigneeId);
    const aCollapsed = opts.collapsedGroupIds.has(aGroupId);
    let sub: ReturnType<typeof buildFlowchart> = {
      nodes: [],
      edges: [],
      height: 0,
      width: 0,
    };
    let width = MIN_ASSIGNEE_WIDTH;
    if (!aCollapsed && ts.length > 0) {
      sub = buildFlowchart(ts, {
        expandedTaskIds: opts.expandedTaskIds,
        onToggleExpand: opts.onToggleTaskExpand,
      });
      sub = {
        ...sub,
        nodes: hydrateNodeData(sub.nodes, opts.projectNames, opts.clientNames),
      };
      width = Math.max(MIN_ASSIGNEE_WIDTH, sub.width);
    }

    return {
      assigneeId,
      groupId: aGroupId,
      label: opts.userNames.get(assigneeId) ?? '(unknown user)',
      collapsed: aCollapsed,
      width,
      taskSub: sub,
    };
  });

  return {
    kind,
    groupId,
    leadTask,
    ...(leadName ? { leadName } : {}),
    collapsed,
    width: 0, // measured later
    assignees,
    taskCount: branchTasks.length + (kind === 'lead' && leadTask ? 1 : 0),
  };
}

// ---------- Width measurement (bottom-up) ----------

function measureWidths(tree: ClientNode[]): void {
  for (const c of tree) {
    for (const p of c.projects) {
      for (const b of p.branches) {
        const inner = b.assignees.reduce(
          (s, a, i) => s + a.width + (i === 0 ? 0 : X_GAP_ASSIGNEE),
          0,
        );
        b.width = Math.max(MIN_BRANCH_WIDTH, inner);
      }
      const inner = p.branches.reduce(
        (s, b, i) => s + b.width + (i === 0 ? 0 : X_GAP_BRANCH),
        0,
      );
      p.width = Math.max(MIN_PROJECT_WIDTH, inner);
    }
    const inner = c.projects.reduce(
      (s, p, i) => s + p.width + (i === 0 ? 0 : X_GAP_PROJECT),
      0,
    );
    c.width = Math.max(MIN_CLIENT_WIDTH, inner);
  }
}

// ---------- Emission (top-down) ----------

function emitClient(
  c: ClientNode,
  x: number,
  depthFloor: number,
  opts: BuildOpts,
  nodes: Node[],
  edges: Edge[],
): void {
  pushHeader(nodes, {
    id: c.groupId,
    type: 'groupHeader',
    position: { x, y: depthFloor * (ROW_HEIGHT + ROW_GAP) },
    data: {
      groupId: c.groupId,
      label: c.label,
      taskCount: c.taskCount,
      statusCounts: {},
      collapsed: c.collapsed,
      onToggle: opts.onToggleGroup,
      width: c.width,
      variant: 'client',
    },
  });

  if (c.collapsed) return;

  const projectInner = c.projects.reduce(
    (s, p, i) => s + p.width + (i === 0 ? 0 : X_GAP_PROJECT),
    0,
  );
  let pX = x + (c.width - projectInner) / 2;
  for (const p of c.projects) {
    emitProject(p, pX, depthFloor + 1, opts, nodes, edges);
    edges.push(makeHierarchyEdge(c.groupId, p.groupId));
    pX += p.width + X_GAP_PROJECT;
  }
}

function emitProject(
  p: ProjectNode,
  x: number,
  depthFloor: number,
  opts: BuildOpts,
  nodes: Node[],
  edges: Edge[],
): void {
  if (opts.showProjectHeader) {
    pushHeader(nodes, {
      id: p.groupId,
      type: 'groupHeader',
      position: { x, y: depthFloor * (ROW_HEIGHT + ROW_GAP) },
      data: {
        groupId: p.groupId,
        label: p.label,
        taskCount: p.taskCount,
        statusCounts: {},
        collapsed: p.collapsed,
        onToggle: opts.onToggleGroup,
        width: p.width,
        variant: 'project',
      },
    });
  }

  if (p.collapsed && opts.showProjectHeader) return;

  const branchInner = p.branches.reduce(
    (s, b, i) => s + b.width + (i === 0 ? 0 : X_GAP_BRANCH),
    0,
  );
  let bX = x + (p.width - branchInner) / 2;
  const branchDepth = opts.showProjectHeader ? depthFloor + 1 : depthFloor;

  for (const b of p.branches) {
    emitBranch(b, bX, branchDepth, opts, nodes, edges);
    if (opts.showProjectHeader) {
      edges.push(makeHierarchyEdge(p.groupId, b.groupId));
    }
    bX += b.width + X_GAP_BRANCH;
  }
}

function emitBranch(
  b: BranchNode,
  x: number,
  depthFloor: number,
  opts: BuildOpts,
  nodes: Node[],
  edges: Edge[],
): void {
  const headerData: GroupHeaderData = {
    groupId: b.groupId,
    label:
      b.kind === 'lead'
        ? b.leadTask?.title ?? `${b.leadName ?? 'Lead'}'s domain`
        : 'Direct admin assignments',
    ...(b.kind === 'lead' && b.leadName
      ? { sublabel: `Led by ${b.leadName}` }
      : {}),
    taskCount: b.taskCount,
    statusCounts: {},
    collapsed: b.collapsed,
    onToggle: opts.onToggleGroup,
    width: b.width,
    variant: b.kind,
    ...(b.kind === 'lead' && b.leadTask
      ? { taskIdToOpen: b.leadTask.id, onOpenTask: opts.onOpenTask }
      : {}),
  };

  pushHeader(nodes, {
    id: b.groupId,
    type: 'groupHeader',
    position: { x, y: depthFloor * (ROW_HEIGHT + ROW_GAP) },
    data: headerData,
  });

  if (b.collapsed) return;

  const assigneeInner = b.assignees.reduce(
    (s, a, i) => s + a.width + (i === 0 ? 0 : X_GAP_ASSIGNEE),
    0,
  );
  let aX = x + (b.width - assigneeInner) / 2;
  const assigneeDepth = depthFloor + 1;

  for (const a of b.assignees) {
    emitAssignee(a, aX, assigneeDepth, opts, nodes, edges);
    edges.push(makeHierarchyEdge(b.groupId, a.groupId));
    aX += a.width + X_GAP_ASSIGNEE;
  }
}

function emitAssignee(
  a: AssigneeNode,
  x: number,
  depthFloor: number,
  opts: BuildOpts,
  nodes: Node[],
  edges: Edge[],
): void {
  pushHeader(nodes, {
    id: a.groupId,
    type: 'groupHeader',
    position: { x, y: depthFloor * (ROW_HEIGHT + ROW_GAP) },
    data: {
      groupId: a.groupId,
      label: a.label,
      taskCount: a.taskSub.nodes.length > 0 ? Math.max(1, countDistinctTasks(a)) : 0,
      statusCounts: {},
      collapsed: a.collapsed,
      onToggle: opts.onToggleGroup,
      width: a.width,
      variant: 'assignee',
    },
  });

  if (a.collapsed) return;

  // Place tasks below this header
  const yTasks = (depthFloor + 1) * (ROW_HEIGHT + ROW_GAP) + TASKS_BELOW_PADDING;
  const colCenterX = x + a.width / 2;

  // Find the topmost row of the task sub-flowchart so we can hook a hierarchy
  // edge from this assignee header to each first event.
  let minSubY = Infinity;
  for (const n of a.taskSub.nodes) {
    if (n.position.y < minSubY) minSubY = n.position.y;
  }
  for (const n of a.taskSub.nodes) {
    nodes.push({
      ...n,
      position: { x: n.position.x + colCenterX, y: n.position.y + yTasks },
    } as Node<EventNodeData>);
    if (n.position.y === minSubY) {
      edges.push(makeHierarchyEdge(a.groupId, n.id));
    }
  }
  for (const e of a.taskSub.edges) edges.push(e);
}

function countDistinctTasks(a: AssigneeNode): number {
  // sub.nodes are events; count distinct task ids
  const set = new Set<string>();
  for (const n of a.taskSub.nodes) {
    const data = n.data as EventNodeData;
    set.add(data.event.taskId);
  }
  return set.size;
}

function pushHeader(nodes: Node[], node: Node): void {
  nodes.push({ ...node, draggable: false, selectable: false });
}

function makeHierarchyEdge(source: string, target: string): Edge {
  return {
    id: `hierarchy_${source}->${target}`,
    source,
    target,
    type: 'smoothstep',
    style: { stroke: 'rgba(45, 226, 212, 0.45)', strokeWidth: 1.5 },
  };
}
