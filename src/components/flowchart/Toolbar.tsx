import type { TaskStatus } from '../../domain/types';
import { STATUS_STYLES } from './statusStyles';

export type StatusFilter = 'all' | TaskStatus;

interface Props {
  showCompleted: boolean;
  onToggleCompleted: (next: boolean) => void;
  projectFilter: string;
  projectOptions: { id: string; name: string }[];
  onProjectFilter: (id: string) => void;
  statusFilter: StatusFilter;
  onStatusFilter: (s: StatusFilter) => void;
  taskCount: number;
}

export function Toolbar({
  showCompleted,
  onToggleCompleted,
  projectFilter,
  projectOptions,
  onProjectFilter,
  statusFilter,
  onStatusFilter,
  taskCount,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-white/5 bg-navy-900/50 backdrop-blur-sm">
      <div className="text-xs font-mono text-slate-500 uppercase tracking-wider">
        {taskCount} task{taskCount === 1 ? '' : 's'}
      </div>

      <div className="h-4 w-px bg-white/10" />

      <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
        <input
          type="checkbox"
          className="accent-teal"
          checked={showCompleted}
          onChange={(e) => onToggleCompleted(e.target.checked)}
        />
        Show completed
      </label>

      <div className="h-4 w-px bg-white/10" />

      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Project</span>
        <select
          className="input-base !py-1.5 !px-3 !text-xs w-44"
          value={projectFilter}
          onChange={(e) => onProjectFilter(e.target.value)}
        >
          <option value="">All projects</option>
          {projectOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Status</span>
        <select
          className="input-base !py-1.5 !px-3 !text-xs w-36"
          value={statusFilter}
          onChange={(e) => onStatusFilter(e.target.value as StatusFilter)}
        >
          <option value="all">All</option>
          {(Object.keys(STATUS_STYLES) as TaskStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_STYLES[s].label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
