import { memo, type MouseEvent } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { motion } from 'framer-motion';
import type { EventNodeData } from '../../lib/flowchartLayout';
import { statusOf } from './statusStyles';
import { PaperclipIcon } from '../../ui/components/IconExtras';

const KIND_LABELS: Record<string, string> = {
  created: 'Created',
  accepted: 'Accepted',
  completed: 'Completed',
  blocker: 'Blocker',
  'blocker-resolved': 'Blocker resolved',
  'status-change': 'Status changed',
  comment: 'Note',
  'requirement-edit': 'Requirements added',
};

function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = m / 60;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function EventNodeImpl({ data }: NodeProps<EventNodeData>) {
  const { event, locked, isNextUp, projectName, expanded, hiddenCount, adminAssigned, onToggleExpand } = data;
  const status = statusOf(event.status);
  const isCurrent = event.isCurrent;

  /** Pulse only when the box represents the task's current state in an urgent status. */
  const pulseClass =
    isCurrent && !locked
      ? event.status === 'blocked'
        ? 'pulse-blocked'
        : event.status === 'on-hold'
        ? 'pulse-hold'
        : event.status === 'requirements-addition'
        ? 'pulse-reqs'
        : ''
      : '';

  // Toggle is visible on the current-event node, when there's anything to expand/collapse.
  const showCollapsedToggle = isCurrent && !expanded && hiddenCount > 0;
  const showExpandedToggle = isCurrent && expanded; // when expanded, we always show the "hide history" link on the current

  function onToggleClick(e: MouseEvent) {
    e.stopPropagation();
    onToggleExpand?.(event.taskId);
  }

  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: 'none' }} />

      {/* Stacked-card hint behind collapsed-with-history nodes */}
      {showCollapsedToggle && (
        <>
          <div
            className="absolute inset-0 -z-10 rounded-2xl border border-white/10 bg-navy-900/40"
            style={{ transform: 'translate(8px, 8px)' }}
            aria-hidden
          />
          <div
            className="absolute inset-0 -z-20 rounded-2xl border border-white/5 bg-navy-900/30"
            style={{ transform: 'translate(16px, 16px)' }}
            aria-hidden
          />
        </>
      )}

      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: isCurrent ? 1 : 0.45, y: 0 }}
        transition={{ duration: 0.25 }}
        className={[
          'glass-card w-[320px] p-3 transition-all',
          status.borderClass,
          isCurrent ? '' : 'grayscale',
          isCurrent && isNextUp ? 'shadow-teal-glow ring-1 ring-teal/40' : '',
          locked ? 'opacity-40' : '',
          pulseClass,
        ].join(' ')}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className={`pill ${status.pillClasses}`}>
            <span
              className="w-1.5 h-1.5 rounded-full inline-block"
              style={{ backgroundColor: status.dot }}
            />
            {status.label}
          </span>
          <div className="flex items-center gap-1.5">
            {event.attachmentIds.length > 0 && (
              <span className="text-teal" title={`${event.attachmentIds.length} attachment(s)`}>
                <PaperclipIcon size={12} />
              </span>
            )}
            <span className="font-mono text-[10px] text-slate-500 uppercase tracking-wider">
              {KIND_LABELS[event.kind] ?? event.kind}
            </span>
          </div>
        </div>

        <h3 className="font-display text-sm font-semibold text-white leading-snug mb-1 truncate">
          {event.task.title}
        </h3>

        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          {projectName && (
            <span className="text-[10px] text-slate-500 truncate">{projectName}</span>
          )}
          {adminAssigned && (
            <span
              className="pill border border-purple-400/30 bg-purple-500/10 text-purple-300 !text-[9px] !py-0 !px-1.5"
              title="Assigned directly by the admin"
            >
              admin
            </span>
          )}
        </div>

        <p className="text-xs text-slate-300 leading-relaxed mb-2 whitespace-pre-wrap line-clamp-3">
          {event.primaryText}
        </p>

        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1.5 border-t border-white/5">
          <span>{fmtTime(event.at)}</span>
          {event.pauseDurationMs ? (
            <span className="text-slate-400">+{fmtDuration(event.pauseDurationMs)} extended</span>
          ) : isCurrent && !locked ? (
            <span className="text-teal">tap to act</span>
          ) : null}
        </div>

        {(showCollapsedToggle || showExpandedToggle) && (
          <button
            type="button"
            onClick={onToggleClick}
            className="mt-2 w-full text-[10px] font-mono uppercase tracking-wider text-teal/80 hover:text-teal transition-colors py-1 rounded-md hover:bg-teal/5"
          >
            {showCollapsedToggle
              ? `↓ Show ${hiddenCount} earlier event${hiddenCount === 1 ? '' : 's'}`
              : '↑ Hide history'}
          </button>
        )}
      </motion.div>
    </div>
  );
}

export const EventNode = memo(EventNodeImpl);
