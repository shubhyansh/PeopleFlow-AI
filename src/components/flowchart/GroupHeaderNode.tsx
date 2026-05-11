import { memo, type MouseEvent } from 'react';
import { motion } from 'framer-motion';
import type { NodeProps } from 'reactflow';
import { ChevronLeftIcon } from '../../ui/components/Icon';
import { SparkleIcon } from '../../ui/components/IconExtras';
import { STATUS_STYLES } from './statusStyles';
import type { TaskStatus } from '../../domain/types';

export type HeaderVariant = 'default' | 'client' | 'project' | 'lead' | 'admin-direct' | 'assignee';

export interface GroupHeaderData {
  groupId: string;
  label: string;
  /** Optional secondary line (e.g. lead's name when label is the leadership task title). */
  sublabel?: string;
  taskCount: number;
  /** Counts per status — only the non-zero ones are rendered as mini pills. */
  statusCounts: Partial<Record<TaskStatus, number>>;
  collapsed: boolean;
  onToggle: (groupId: string) => void;
  /** Header width, set by the layout to match its column. */
  width: number;
  /** Visual variant — affects accent color + icon. Default = teal-tinted. */
  variant?: HeaderVariant;
  /** When set, clicking the body (not the chevron) opens this task in the drawer. */
  taskIdToOpen?: string;
  onOpenTask?: (taskId: string) => void;
}

const VARIANT_STYLES: Record<HeaderVariant, string> = {
  default: 'border-teal/20 bg-navy-900/80 hover:border-teal/40',
  client: 'border-teal/30 bg-navy-900/85 hover:border-teal/50',
  project: 'border-teal/20 bg-navy-900/75 hover:border-teal/40',
  lead: 'border-amber-400/35 bg-amber-500/[0.06] hover:border-amber-400/55',
  'admin-direct': 'border-purple-400/30 bg-purple-500/[0.06] hover:border-purple-400/50',
  assignee: 'border-white/10 bg-navy-900/60 hover:border-teal/30',
};

const VARIANT_BADGE: Partial<Record<HeaderVariant, { label: string; cls: string }>> = {
  lead: {
    label: 'LEAD TASK',
    cls: 'border-amber-400/40 bg-amber-500/15 text-amber-300',
  },
  'admin-direct': {
    label: 'ADMIN-DIRECT',
    cls: 'border-purple-400/40 bg-purple-500/15 text-purple-300',
  },
};

/** Header rendered above each group's chains in the org-wide flowchart. */
function GroupHeaderNodeImpl({ data }: NodeProps<GroupHeaderData>) {
  const {
    label,
    sublabel,
    taskCount,
    statusCounts,
    collapsed,
    onToggle,
    groupId,
    width,
    variant = 'default',
    taskIdToOpen,
    onOpenTask,
  } = data;
  const orderedStatuses: TaskStatus[] = [
    'pending',
    'active',
    'parallel',
    'requirements-addition',
    'blocked',
    'on-hold',
    'completed',
  ];
  const badge = VARIANT_BADGE[variant];

  function handleChevron(e: MouseEvent) {
    e.stopPropagation();
    onToggle(groupId);
  }
  function handleBodyClick() {
    if (taskIdToOpen && onOpenTask) onOpenTask(taskIdToOpen);
    else onToggle(groupId);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleBodyClick}
        style={{ width }}
        className={[
          'flex items-center gap-4 px-5 py-4 rounded-2xl border backdrop-blur-sm transition-colors text-left shadow-glass',
          VARIANT_STYLES[variant],
        ].join(' ')}
      >
        <span
          role="button"
          tabIndex={0}
          onClick={handleChevron}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onToggle(groupId);
            }
          }}
          className="inline-flex shrink-0 p-1 -m-1 rounded hover:bg-white/5 transition-colors"
          aria-label={collapsed ? 'Expand' : 'Collapse'}
        >
          <motion.span
            animate={{ rotate: collapsed ? -90 : 0 }}
            transition={{ duration: 0.2 }}
            className="inline-flex text-teal"
          >
            <ChevronLeftIcon size={16} />
          </motion.span>
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {variant === 'lead' && <SparkleIcon size={14} className="text-amber-300 shrink-0" />}
            <div className="font-display text-base font-semibold text-white truncate">{label}</div>
            {badge && (
              <span
                className={`pill border ${badge.cls} !text-[9px] !py-0 !px-1.5 shrink-0`}
                title={badge.label}
              >
                {badge.label}
              </span>
            )}
          </div>
          {sublabel && (
            <div className="text-[11px] font-mono text-slate-400 truncate mt-0.5">{sublabel}</div>
          )}
          <div className="text-xs text-slate-500 mt-0.5">
            {taskCount} task{taskCount === 1 ? '' : 's'}
            {collapsed ? ' · collapsed' : ''}
            {taskIdToOpen ? ' · click to open' : ''}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0 max-w-[60%]">
          {orderedStatuses.map((s) => {
            const count = statusCounts[s];
            if (!count) return null;
            const style = STATUS_STYLES[s];
            return (
              <span
                key={s}
                className={`pill ${style.pillClasses} text-[10px] !py-0.5`}
                title={style.label}
              >
                <span
                  className="w-1 h-1 rounded-full inline-block"
                  style={{ backgroundColor: style.dot }}
                />
                {count}
              </span>
            );
          })}
        </div>
      </button>
    </div>
  );
}

export const GroupHeaderNode = memo(GroupHeaderNodeImpl);
