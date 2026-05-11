import { chatGroqJson } from './groqClient';
import type { DevTaskKind, TaskType } from '../domain/types';

export interface OutlineSection {
  /** Stable id used as a state key (kebab-case). */
  key: string;
  /** Short display title (1-3 words). */
  title: string;
  /** One-line subtitle to hint what to write. */
  hint?: string;
}

export interface SpecOutline {
  sections: OutlineSection[];
}

/* ---- Kind-specific default outlines (used when AI is unavailable, or as a starting point) ---- */

const DEFAULTS: Record<string, OutlineSection[]> = {
  bug: [
    { key: 'repro', title: 'Reproduction steps', hint: 'Exact steps to trigger the bug.' },
    { key: 'expected-actual', title: 'Expected vs actual', hint: 'What should happen vs what does.' },
    { key: 'hypothesis', title: 'Likely root cause', hint: 'Where do you suspect the issue?' },
    { key: 'verify', title: 'How to verify the fix', hint: 'Tests or checks to confirm.' },
  ],
  frontend: [
    { key: 'scope', title: 'Scope of work', hint: 'Components, pages, interactions to build.' },
    { key: 'constraints', title: 'Constraints', hint: 'Performance, accessibility, browser support.' },
    { key: 'edges', title: 'Edge cases', hint: 'Loading / empty / error states.' },
    { key: 'acceptance', title: 'Acceptance criteria', hint: 'Done = ?' },
  ],
  backend: [
    { key: 'scope', title: 'Scope of work', hint: 'APIs, services, data models.' },
    { key: 'contracts', title: 'API contracts', hint: 'Inputs, outputs, error codes.' },
    { key: 'constraints', title: 'Constraints', hint: 'Latency, throughput, security.' },
    { key: 'acceptance', title: 'Acceptance criteria' },
  ],
  api: [
    { key: 'scope', title: 'Scope of work' },
    { key: 'auth', title: 'Auth + secrets', hint: 'Where credentials live; rate limits.' },
    { key: 'mapping', title: 'Data mapping', hint: 'How external fields map to ours.' },
    { key: 'acceptance', title: 'Acceptance criteria' },
  ],
  database: [
    { key: 'schema', title: 'Schema changes', hint: 'New tables, columns, indexes.' },
    { key: 'migration', title: 'Migration strategy', hint: 'Backfill, rollout, rollback.' },
    { key: 'constraints', title: 'Constraints', hint: 'Performance, data integrity.' },
    { key: 'acceptance', title: 'Acceptance criteria' },
  ],
  devops: [
    { key: 'scope', title: 'Scope of work' },
    { key: 'environments', title: 'Environments', hint: 'Dev / staging / prod.' },
    { key: 'rollback', title: 'Rollout + rollback' },
    { key: 'acceptance', title: 'Acceptance criteria' },
  ],
  testing: [
    { key: 'coverage', title: 'Coverage targets', hint: 'What to test; what to skip.' },
    { key: 'tools', title: 'Tooling', hint: 'Frameworks, CI integration.' },
    { key: 'edges', title: 'Edge cases' },
    { key: 'acceptance', title: 'Acceptance criteria' },
  ],
  docs: [
    { key: 'audience', title: 'Audience', hint: 'Who reads this; their context.' },
    { key: 'scope', title: 'Scope', hint: 'What topics / sections.' },
    { key: 'examples', title: 'Examples', hint: 'Code samples, screenshots.' },
    { key: 'acceptance', title: 'Acceptance criteria' },
  ],
  other: [
    { key: 'scope', title: 'Scope of work' },
    { key: 'constraints', title: 'Constraints' },
    { key: 'acceptance', title: 'Acceptance criteria' },
  ],
  leadership: [
    { key: 'plan', title: 'Project plan / milestones' },
    { key: 'team', title: 'Team responsibilities' },
    { key: 'risks', title: 'Risks & dependencies' },
    { key: 'metrics', title: 'Success metrics' },
  ],
};

export function defaultOutline(type: TaskType, devKind?: DevTaskKind | null): SpecOutline {
  if (type === 'leadership') return { sections: [...DEFAULTS.leadership] };
  const key = (devKind ?? 'other') as keyof typeof DEFAULTS;
  return { sections: [...(DEFAULTS[key] ?? DEFAULTS.other)] };
}

/**
 * Asks the AI to tailor a brief outline for this specific task. Falls back to
 * the kind-specific default if the AI is unavailable or returns junk.
 */
export async function generateOutline(input: {
  title: string;
  shortDescription: string;
  type: TaskType;
  devKind?: DevTaskKind | null;
}): Promise<SpecOutline> {
  const fallback = defaultOutline(input.type, input.devKind);

  const sys = [
    'You are helping a PM author a concise software-task brief.',
    'Given the task title + a 1-3 sentence opening description, produce a checklist of 3 to 6 sections to fill in.',
    'Each section: a 1-3 word title and an optional 1-line hint of what to write.',
    'Tailor to this specific task — drop sections that do not apply, add ones that do.',
    'Reply with JSON ONLY: {"sections":[{"key":"kebab-case-id","title":"Short title","hint":"Optional one-line"}]}',
    'No prose, no commentary.',
  ].join('\n');

  const user =
    `Title: ${input.title}\n` +
    `Opening description: ${input.shortDescription}\n` +
    `Type: ${input.type}` +
    (input.devKind ? `, kind: ${input.devKind}` : '') +
    '\n\nGenerate the outline.';

  const result = await chatGroqJson<SpecOutline>(
    [
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ],
    { temperature: 0.3, maxTokens: 600 },
  );

  if (result.stub) return fallback;
  const parsed = result.data;
  if (!parsed?.sections?.length) return fallback;

  // Sanity-check: every section needs a key + title
  const cleaned = parsed.sections
    .filter((s): s is OutlineSection => Boolean(s?.key && s?.title))
    .slice(0, 6);
  if (cleaned.length === 0) return fallback;
  return { sections: cleaned };
}
