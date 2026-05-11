import { motion } from 'framer-motion';

export interface ChoiceOption<V extends string> {
  value: V;
  label: string;
  hint?: string;
}

interface Props<V extends string> {
  options: ChoiceOption<V>[];
  onSelect: (value: V) => void;
  layout?: 'inline' | 'grid';
  disabled?: boolean;
}

export function InlineChoice<V extends string>({
  options,
  onSelect,
  layout = 'inline',
  disabled,
}: Props<V>) {
  return (
    <div
      className={
        layout === 'grid'
          ? 'grid grid-cols-2 sm:grid-cols-3 gap-2'
          : 'flex flex-wrap gap-2'
      }
    >
      {options.map((opt) => (
        <motion.button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(opt.value)}
          whileHover={{ scale: disabled ? 1 : 1.02 }}
          whileTap={{ scale: disabled ? 1 : 0.98 }}
          className={[
            'text-left px-4 py-2.5 rounded-xl border text-sm transition-colors',
            'border-white/10 bg-navy-900/60 text-slate-200',
            'hover:border-teal/40 hover:bg-teal/5 hover:text-white',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-white/10 disabled:hover:bg-navy-900/60',
          ].join(' ')}
        >
          <div className="font-medium">{opt.label}</div>
          {opt.hint && <div className="text-xs text-slate-500 mt-0.5">{opt.hint}</div>}
        </motion.button>
      ))}
    </div>
  );
}
