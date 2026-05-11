import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckIcon } from '../../ui/components/IconExtras';

export interface MultiChoiceOption<V extends string> {
  value: V;
  label: string;
  hint?: string;
  /** When true, the chip is rendered selected and the user cannot toggle it off. */
  locked?: boolean;
}

interface Props<V extends string> {
  options: MultiChoiceOption<V>[];
  /** Initial / always-selected ids. */
  initialSelected?: V[];
  minSelected?: number;
  confirmLabel?: string;
  onConfirm: (selected: V[]) => void;
}

export function MultiChoice<V extends string>({
  options,
  initialSelected,
  minSelected = 0,
  confirmLabel = 'Confirm selection',
  onConfirm,
}: Props<V>) {
  const lockedIds = options.filter((o) => o.locked).map((o) => o.value);
  const [selected, setSelected] = useState<Set<V>>(
    () => new Set([...(initialSelected ?? []), ...lockedIds]),
  );

  function toggle(v: V) {
    const opt = options.find((o) => o.value === v);
    if (opt?.locked) return;
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
  }

  const count = selected.size;
  const enough = count >= minSelected;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {options.map((opt) => {
          const isSelected = selected.has(opt.value);
          return (
            <motion.button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              whileHover={{ scale: opt.locked ? 1 : 1.02 }}
              whileTap={{ scale: opt.locked ? 1 : 0.98 }}
              className={[
                'text-left px-3 py-2.5 rounded-xl border text-sm transition-colors flex items-start gap-2',
                isSelected
                  ? 'border-teal/50 bg-teal/10 text-white'
                  : 'border-white/10 bg-navy-900/60 text-slate-200 hover:border-teal/40 hover:bg-teal/5 hover:text-white',
                opt.locked ? 'opacity-90 cursor-default' : '',
              ].join(' ')}
            >
              <span
                className={[
                  'mt-0.5 inline-flex items-center justify-center w-4 h-4 rounded border shrink-0',
                  isSelected
                    ? 'border-teal bg-teal text-navy-950'
                    : 'border-white/20 bg-transparent text-transparent',
                ].join(' ')}
              >
                <CheckIcon size={12} />
              </span>
              <span className="flex-1 min-w-0">
                <div className="font-medium truncate flex items-center gap-1.5">
                  {opt.label}
                  {opt.locked && (
                    <span className="font-mono text-[9px] text-teal/70 uppercase tracking-wider">
                      lead
                    </span>
                  )}
                </div>
                {opt.hint && <div className="text-xs text-slate-500 mt-0.5">{opt.hint}</div>}
              </span>
            </motion.button>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-slate-500">
          {count} selected
          {minSelected > 0 && !enough ? ` · pick at least ${minSelected}` : ''}
        </span>
        <button
          type="button"
          onClick={() => onConfirm(Array.from(selected))}
          className="btn-primary !py-2 !text-sm"
          disabled={!enough}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
