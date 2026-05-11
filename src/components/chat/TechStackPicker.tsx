import { useState, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { CloseIcon, PlusIcon } from '../../ui/components/Icon';

interface Props {
  initial: string[];
  onConfirm: (techStack: string[]) => void;
}

const PRESET_GROUPS: { label: string; items: string[] }[] = [
  {
    label: 'Languages',
    items: [
      'TypeScript',
      'JavaScript',
      'Python',
      'Go',
      'Rust',
      'Java',
      'C#',
      'Swift',
      'Kotlin',
      'Ruby',
    ],
  },
  {
    label: 'Frontend',
    items: ['React', 'Vue', 'Svelte', 'Next.js', 'Tailwind CSS', 'React Native', 'Flutter'],
  },
  {
    label: 'Backend',
    items: ['Node.js', 'Express', 'FastAPI', 'Django', 'Spring', 'Rails', '.NET'],
  },
  {
    label: 'Storage',
    items: ['Postgres', 'MySQL', 'MongoDB', 'Redis', 'S3', 'Supabase', 'Firebase'],
  },
  {
    label: 'Infra',
    items: [
      'Docker',
      'Kubernetes',
      'GitHub Actions',
      'AWS',
      'GCP',
      'Vercel',
      'Cloudflare',
      'Nginx',
    ],
  },
  {
    label: 'AI / ML',
    items: ['OpenAI API', 'Anthropic API', 'Groq API', 'Hugging Face', 'PyTorch', 'TensorFlow'],
  },
];

export function TechStackPicker({ initial, onConfirm }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initial));
  const [customDraft, setCustomDraft] = useState('');

  function toggle(item: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  }

  function addCustom() {
    const v = customDraft.trim();
    if (!v) return;
    setSelected((cur) => new Set([...cur, v]));
    setCustomDraft('');
  }

  function onCustomKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustom();
    }
  }

  // Determine which selected items are custom (not in any preset)
  const presetSet = new Set(PRESET_GROUPS.flatMap((g) => g.items));
  const customSelected = Array.from(selected).filter((s) => !presetSet.has(s));

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-5 space-y-4"
    >
      <div>
        <div className="font-mono text-[10px] text-teal uppercase tracking-wider mb-1">
          Tech stack
        </div>
        <p className="text-xs text-slate-400">
          Pick anything the developer will use. Helps the assignee see at a glance what's involved
          and keeps architecture diagrams aligned with the codebase.
        </p>
      </div>

      <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
        {PRESET_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">
              {group.label}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {group.items.map((item) => {
                const on = selected.has(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggle(item)}
                    className={[
                      'px-2.5 py-1 rounded-lg text-xs border transition-colors',
                      on
                        ? 'border-teal/50 bg-teal/15 text-teal'
                        : 'border-white/10 bg-navy-900/60 text-slate-300 hover:border-teal/30 hover:bg-teal/5',
                    ].join(' ')}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {customSelected.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">
              Custom
            </div>
            <div className="flex flex-wrap gap-1.5">
              {customSelected.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border border-amber-400/30 bg-amber-500/10 text-amber-300"
                >
                  {item}
                  <button
                    type="button"
                    onClick={() => toggle(item)}
                    className="text-amber-300/70 hover:text-amber-200"
                    aria-label={`Remove ${item}`}
                  >
                    <CloseIcon size={10} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Add a custom tool…"
          className="input-base !py-1.5 !text-sm"
          value={customDraft}
          onChange={(e) => setCustomDraft(e.target.value)}
          onKeyDown={onCustomKey}
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={!customDraft.trim()}
          className="btn-ghost !py-1.5 !text-sm shrink-0"
        >
          <PlusIcon size={12} />
          Add
        </button>
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-slate-500">
          {selected.size} item{selected.size === 1 ? '' : 's'} selected
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onConfirm([])}
            className="text-xs text-slate-400 hover:text-slate-200 px-2"
          >
            Skip
          </button>
          <button type="button" onClick={() => onConfirm(Array.from(selected))} className="btn-primary">
            Continue
          </button>
        </div>
      </div>
    </motion.div>
  );
}
