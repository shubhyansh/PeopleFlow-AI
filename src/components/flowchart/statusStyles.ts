import type { TaskStatus } from '../../domain/types';

export interface StatusStyle {
  label: string;
  pillClasses: string;
  borderClass: string;
  /** Small dot color in hex for emoji-like sense markers */
  dot: string;
}

export const STATUS_STYLES: Record<TaskStatus, StatusStyle> = {
  pending: {
    label: 'Pending',
    pillClasses: 'border border-blue-400/40 bg-blue-500/10 text-blue-300',
    borderClass: 'border-blue-500/30',
    dot: '#60a5fa',
  },
  active: {
    label: 'Active',
    pillClasses: 'border border-amber-400/40 bg-amber-500/10 text-amber-300',
    borderClass: 'border-amber-500/40',
    dot: '#f5b942',
  },
  parallel: {
    label: 'Parallel',
    pillClasses: 'border border-orange-400/40 bg-orange-500/10 text-orange-300',
    borderClass: 'border-orange-500/40',
    dot: '#fb923c',
  },
  blocked: {
    label: 'Blocked',
    pillClasses: 'border border-red-400/40 bg-red-500/10 text-red-300',
    borderClass: 'border-red-500/40',
    dot: '#ef4444',
  },
  'requirements-addition': {
    label: 'Reqs added',
    pillClasses: 'border border-purple-400/40 bg-purple-500/10 text-purple-300',
    borderClass: 'border-purple-500/40',
    dot: '#a855f7',
  },
  'on-hold': {
    label: 'On hold',
    pillClasses: 'border border-slate-400/40 bg-slate-500/10 text-slate-300',
    borderClass: 'border-slate-500/40',
    dot: '#94a3b8',
  },
  completed: {
    label: 'Completed',
    pillClasses: 'border border-green-400/40 bg-green-500/10 text-green-300',
    borderClass: 'border-green-500/40',
    dot: '#22c55e',
  },
};

export function statusOf(s: TaskStatus): StatusStyle {
  return STATUS_STYLES[s];
}
