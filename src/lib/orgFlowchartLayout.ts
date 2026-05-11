import type { Edge, Node } from 'reactflow';
import type { Task, TaskStatus } from '../domain/types';
import { buildFlowchart, hydrateNodeData, type EventNodeData } from './flowchartLayout';
import type { GroupHeaderData } from '../components/flowchart/GroupHeaderNode';

export interface OrgGroup {
  id: string;
  label: string;
  tasks: Task[];
}

interface BuildOpts {
  groups: OrgGroup[];
  collapsedGroupIds: Set<string>;
  expandedTaskIds: Set<string>;
  onToggleTaskExpand: (taskId: string) => void;
  projects: Map<string, string>;
  clients: Map<string, string>;
  onToggleGroup: (groupId: string) => void;
}

const HEADER_HEIGHT = 70;
const HEADER_TO_CHAINS_GAP = 30;
const GROUP_GAP_X = 80;
/** Minimum column width — used for groups with one column or collapsed groups. */
const MIN_COLUMN_WIDTH = 360;

/**
 * Lays out groups HORIZONTALLY (left-to-right). Each group becomes a column:
 *  - A header node spanning the column width sits at the top
 *  - Below the header, the group's event chains render in their normal vertical
 *    layout (oldest task on top, parallel tasks side-by-side at the same row)
 *
 * This matches the spec: separate entities (groups) are side-by-side, while
 * tasks in the same connectivity string (a group's chain) flow downward by date.
 */
export function buildOrgFlowchart(opts: BuildOpts): {
  nodes: Node[];
  edges: Edge[];
} {
  const {
    groups,
    collapsedGroupIds,
    expandedTaskIds,
    onToggleTaskExpand,
    projects,
    clients,
    onToggleGroup,
  } = opts;

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let xCursor = 0;

  for (const group of groups) {
    const collapsed = collapsedGroupIds.has(group.id);
    const statusCounts = countByStatus(group.tasks);

    let columnWidth = MIN_COLUMN_WIDTH;
    let subNodes: Node<EventNodeData>[] = [];
    let subEdges: Edge[] = [];

    if (!collapsed && group.tasks.length > 0) {
      const sub = buildFlowchart(group.tasks, {
        expandedTaskIds,
        onToggleExpand: onToggleTaskExpand,
      });
      const hydrated = hydrateNodeData(sub.nodes, projects, clients);
      subNodes = hydrated;
      subEdges = sub.edges;
      columnWidth = Math.max(MIN_COLUMN_WIDTH, sub.width);
    }

    const headerData: GroupHeaderData = {
      groupId: group.id,
      label: group.label,
      taskCount: group.tasks.length,
      statusCounts,
      collapsed,
      onToggle: onToggleGroup,
      width: columnWidth,
    };

    // Header at the top of the column, x-aligned to xCursor (column's left edge).
    nodes.push({
      id: `group:${group.id}`,
      type: 'groupHeader',
      position: { x: xCursor, y: 0 },
      data: headerData,
      draggable: false,
      selectable: false,
    });

    if (!collapsed && subNodes.length > 0) {
      // buildFlowchart positions nodes centered around x=0. Shift each by the
      // column's center so its tasks land within this column.
      const colCenterX = xCursor + columnWidth / 2;
      const yOffset = HEADER_HEIGHT + HEADER_TO_CHAINS_GAP;

      subNodes.forEach((n) => {
        nodes.push({
          ...n,
          position: { x: n.position.x + colCenterX, y: n.position.y + yOffset },
        });
      });
      subEdges.forEach((e) => edges.push(e));
    }

    xCursor += columnWidth + GROUP_GAP_X;
  }

  return { nodes, edges };
}

function countByStatus(tasks: Task[]): Partial<Record<TaskStatus, number>> {
  const counts: Partial<Record<TaskStatus, number>> = {};
  tasks.forEach((t) => {
    counts[t.status] = (counts[t.status] ?? 0) + 1;
  });
  return counts;
}
