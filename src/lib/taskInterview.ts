import { chatGroqJson } from './groqClient';
import type { DevTaskKind, TaskType } from '../domain/types';
import type { SpecOutline } from './specOutline';

/** A note recorded during the AI clarifier loop. Each one becomes a bullet in the brief's Notes section. */
export interface BriefNote {
  /** The phrase from the admin's text the AI flagged. */
  phrase: string;
  /** The admin's clarifying answer. */
  answer: string;
}

export interface InterviewBrief {
  type: TaskType | null;
  projectId: string | null;
  projectName: string;
  clientId: string | null;
  clientName: string;
  title: string;
  /** Short opening description (2-3 sentences) — used to drive outline generation. */
  shortDescription: string;
  /** Full markdown brief composed at save time from sections + notes. */
  description: string;
  devKind: DevTaskKind | null;
  expectedOutput: string;
  /** AI-generated, admin-editable outline of sections to fill. */
  outline: SpecOutline | null;
  /** Per-section bodies, keyed by OutlineSection.key. */
  sections: Record<string, string>;
  /** Clarifier outputs from the AI probe loop. */
  notes: BriefNote[];
  /** Tech stack chips picked during the interview. */
  techStack: string[];
  // Leadership-only:
  leadId: string | null;
  memberIds: string[];
}

export const INITIAL_BRIEF: InterviewBrief = {
  type: null,
  projectId: null,
  projectName: '',
  clientId: null,
  clientName: '',
  title: '',
  shortDescription: '',
  description: '',
  devKind: null,
  expectedOutput: '',
  outline: null,
  sections: {},
  notes: [],
  techStack: [],
  leadId: null,
  memberIds: [],
};

/** Builds the markdown brief from outline + sections + notes at save time. */
export function composeBrief(brief: InterviewBrief): string {
  const parts: string[] = [];
  if (brief.shortDescription.trim()) {
    parts.push(`## Overview\n\n${brief.shortDescription.trim()}`);
  }
  if (brief.outline) {
    for (const s of brief.outline.sections) {
      const body = brief.sections[s.key]?.trim();
      if (body) parts.push(`## ${s.title}\n\n${body}`);
    }
  }
  if (brief.notes.length > 0) {
    const bullets = brief.notes
      .map((n) => `- "${n.phrase}" → ${n.answer}`)
      .join('\n');
    parts.push(`## Notes\n\n${bullets}`);
  }
  return parts.join('\n\n');
}

/* ---------- req.md import / export ---------- */

interface ReqMdMetadata {
  title?: string;
  type?: TaskType;
  devKind?: DevTaskKind;
  projectName?: string;
  clientName?: string;
  assigneeName?: string;
}

export interface ParsedReqMd extends ReqMdMetadata {
  techStack: string[];
  shortDescription: string;
  expectedOutput: string;
  outline: import('./specOutline').SpecOutline;
  sections: Record<string, string>;
  notes: BriefNote[];
}

/**
 * Generates a portable req.md document from an interview brief — frontmatter
 * with metadata + section bodies + expected output + notes.
 */
export function composeReqMd(
  brief: InterviewBrief,
  meta: { assigneeName?: string } = {},
): string {
  const fm: string[] = ['---'];
  if (brief.title) fm.push(`title: ${brief.title}`);
  if (brief.type) fm.push(`type: ${brief.type}`);
  if (brief.devKind) fm.push(`kind: ${brief.devKind}`);
  if (brief.projectName) fm.push(`project: ${brief.projectName}`);
  if (brief.clientName) fm.push(`client: ${brief.clientName}`);
  if (meta.assigneeName) fm.push(`assignee: ${meta.assigneeName}`);
  if (brief.techStack.length > 0) {
    fm.push(`techStack: ${brief.techStack.join(', ')}`);
  }
  fm.push('---', '');

  const body: string[] = [];
  if (brief.shortDescription.trim()) {
    body.push(`## Overview\n\n${brief.shortDescription.trim()}`);
  }
  if (brief.outline) {
    for (const s of brief.outline.sections) {
      const sectionBody = brief.sections[s.key]?.trim();
      if (sectionBody) body.push(`## ${s.title}\n\n${sectionBody}`);
    }
  }
  if (brief.expectedOutput.trim()) {
    body.push(`## Expected Output\n\n${brief.expectedOutput.trim()}`);
  }
  if (brief.notes.length > 0) {
    const bullets = brief.notes
      .map((n) => `- "${n.phrase}" → ${n.answer}`)
      .join('\n');
    body.push(`## Notes\n\n${bullets}`);
  }

  return fm.join('\n') + body.join('\n\n');
}

/**
 * Generates a BLANK CHECKLIST template — the outline's sections with empty
 * bodies (plus the existing values if any). Admin downloads this, fills it
 * offline, and re-uploads via `parseReqMd`. The placeholders make it obvious
 * what to write under each section.
 */
export function composeChecklistTemplate(
  brief: InterviewBrief,
  meta: { assigneeName?: string } = {},
): string {
  const fm: string[] = ['---'];
  if (brief.title) fm.push(`title: ${brief.title}`);
  if (brief.type) fm.push(`type: ${brief.type}`);
  if (brief.devKind) fm.push(`kind: ${brief.devKind}`);
  if (brief.projectName) fm.push(`project: ${brief.projectName}`);
  if (brief.clientName) fm.push(`client: ${brief.clientName}`);
  if (meta.assigneeName) fm.push(`assignee: ${meta.assigneeName}`);
  if (brief.techStack.length > 0) fm.push(`techStack: ${brief.techStack.join(', ')}`);
  fm.push('---', '');

  const body: string[] = [];
  body.push(
    `## Overview\n\n${
      brief.shortDescription.trim() || '_2–3 sentences on what + why._'
    }`,
  );

  if (brief.outline) {
    for (const s of brief.outline.sections) {
      const current = brief.sections[s.key]?.trim();
      const placeholder = s.hint ? `_${s.hint}_` : '_Write your answer here._';
      body.push(`## ${s.title}\n\n${current || placeholder}`);
    }
  }

  body.push(
    `## Expected Output\n\n${
      brief.expectedOutput.trim() || '_What the final deliverable looks like._'
    }`,
  );

  return fm.join('\n') + body.join('\n\n');
}

/**
 * Generates a req.md from an already-saved Task. The `task.brief` is already
 * markdown so we just prepend frontmatter and append expectedOutput.
 */
export function composeReqMdFromTask(
  task: import('../domain/types').Task,
  meta: { assigneeName?: string; projectName?: string; clientName?: string } = {},
): string {
  const fm: string[] = ['---'];
  if (task.title) fm.push(`title: ${task.title}`);
  if (task.type) fm.push(`type: ${task.type}`);
  if (task.devKind) fm.push(`kind: ${task.devKind}`);
  if (meta.projectName) fm.push(`project: ${meta.projectName}`);
  if (meta.clientName) fm.push(`client: ${meta.clientName}`);
  if (meta.assigneeName) fm.push(`assignee: ${meta.assigneeName}`);
  if (task.techStack.length > 0) {
    fm.push(`techStack: ${task.techStack.join(', ')}`);
  }
  fm.push('---', '');

  const body: string[] = [];
  if (task.brief.trim()) body.push(task.brief.trim());
  if (task.expectedOutput.trim()) {
    body.push(`## Expected Output\n\n${task.expectedOutput.trim()}`);
  }
  return fm.join('\n') + body.join('\n\n');
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'sec'
  );
}

/**
 * Parses a req.md document. Recognized sections (case-insensitive):
 *  - "Overview" → shortDescription
 *  - "Expected Output" → expectedOutput
 *  - "Tech Stack" (if frontmatter missing it) → techStack
 *  - "Notes" → notes (parsed from `- "phrase" → answer` bullets)
 *  - All other `## …` → sections (key generated by slugify)
 */
export function parseReqMd(md: string): ParsedReqMd {
  const result: ParsedReqMd = {
    techStack: [],
    shortDescription: '',
    expectedOutput: '',
    outline: { sections: [] },
    sections: {},
    notes: [],
  };

  let bodyText = md;
  const fmMatch = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(md);
  if (fmMatch) {
    bodyText = md.slice(fmMatch[0].length);
    for (const line of fmMatch[1].split(/\r?\n/)) {
      const kv = /^(\w+)\s*:\s*(.+)$/.exec(line);
      if (!kv) continue;
      const value = kv[2].trim();
      switch (kv[1]) {
        case 'title':
          result.title = value;
          break;
        case 'type':
          if (value === 'development' || value === 'leadership') result.type = value;
          break;
        case 'kind':
          result.devKind = value as DevTaskKind;
          break;
        case 'project':
          result.projectName = value;
          break;
        case 'client':
          result.clientName = value;
          break;
        case 'assignee':
          result.assigneeName = value;
          break;
        case 'techStack':
        case 'tech_stack':
          result.techStack = value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          break;
        default:
          // ignore unknown frontmatter keys
          break;
      }
    }
  }

  // Body sections — split on `^## `
  const chunks = bodyText.split(/\r?\n##\s+/);
  // chunks[0] is anything before the first `## ` (usually empty if frontmatter handled)
  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i];
    const newlineIdx = chunk.indexOf('\n');
    const title = (newlineIdx === -1 ? chunk : chunk.slice(0, newlineIdx)).trim();
    const sectionBody = (newlineIdx === -1 ? '' : chunk.slice(newlineIdx + 1)).trim();
    const titleNorm = title.toLowerCase();

    if (titleNorm === 'overview') {
      result.shortDescription = sectionBody;
    } else if (titleNorm === 'expected output') {
      result.expectedOutput = sectionBody;
    } else if (titleNorm === 'tech stack') {
      if (result.techStack.length === 0) {
        result.techStack = sectionBody
          .split(/[\n,]+/)
          .map((s) => s.trim().replace(/^[-*]\s*/, ''))
          .filter(Boolean);
      }
    } else if (titleNorm === 'notes') {
      const bulletLines = sectionBody
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.startsWith('-') || l.startsWith('*'));
      result.notes = bulletLines.map((line) => {
        const cleaned = line.replace(/^[-*]\s*/, '');
        const m = /^"([^"]+)"\s*[→\->]+\s*(.+)$/.exec(cleaned);
        if (m) return { phrase: m[1], answer: m[2] };
        return { phrase: '', answer: cleaned };
      });
    } else {
      const key = slugify(title);
      result.outline.sections.push({ key, title });
      result.sections[key] = sectionBody;
    }
  }

  return result;
}

export type InterviewStep =
  | 'pick-type'
  | 'pick-project'
  | 'pick-client'
  | 'pick-lead' // leadership only
  | 'pick-team' // leadership only
  | 'ask-title'
  | 'ask-short-description'
  | 'generating-outline' // AI is generating
  | 'review-outline'
  | 'fill-sections-bulk' // all sections in one form
  | 'probe-after-bulk' // optional single AI clarifier after bulk submit
  | 'fill-section' // (legacy) looped, one per outline section
  | 'pick-dev-kind' // development only
  | 'pick-tech-stack'
  | 'ask-expected-output'
  | 'probe-output'
  | 'diagrams'
  | 'attachments'
  | 'summary'
  | 'saving'
  | 'done';

export const TASK_KIND_OPTIONS: { value: DevTaskKind; label: string }[] = [
  { value: 'bug', label: 'Bug Resolution' },
  { value: 'frontend', label: 'Frontend' },
  { value: 'backend', label: 'Backend' },
  { value: 'api', label: 'API Integration' },
  { value: 'database', label: 'Database' },
  { value: 'devops', label: 'DevOps / Deployment' },
  { value: 'testing', label: 'Testing' },
  { value: 'docs', label: 'Documentation' },
  { value: 'other', label: 'Other' },
];

const MAX_PROBES_PER_FIELD = 1;

interface ProbeResponse {
  clarification_needed: boolean;
  /** The full follow-up message — may include multiple related sub-questions when several gaps exist. */
  follow_up?: string;
  /** Specific phrase from the admin's text that triggered probing, for UI highlighting. */
  unclear_phrase?: string;
  /** What categories of issue were detected (vague_term, missing_constraint, undefined_scope, no_success_criteria, ambiguous_actor, etc). */
  issues?: string[];
}

interface ProbeContext {
  field: 'description' | 'expected_output';
  brief: InterviewBrief;
  /** Conversation transcript for THIS field — pairs of (probe question, user reply). */
  history: { question: string; answer: string }[];
}

/**
 * Asks Groq whether the most recent answer needs clarification. Returns null if
 * we should move on. Returns a follow-up question (and optionally the unclear
 * phrase) if probing is needed. Caps at MAX_PROBES_PER_FIELD.
 *
 * The model is prompted as a senior tech lead reviewing a brief before
 * delegating — it should default to PROBING when there is any meaningful
 * ambiguity, and may ask multiple related sub-questions in a single turn when
 * several gaps exist together.
 */
export async function probeForClarity(
  ctx: ProbeContext,
): Promise<{ followUp: string; unclearPhrase: string | null } | null> {
  if (ctx.history.length >= MAX_PROBES_PER_FIELD) return null;

  const fieldLabel =
    ctx.field === 'description' ? 'task description' : 'expected output';

  const system = [
    'You review a software-task brief for a single section. If anything genuinely needs clarifying, ask ONE concise question.',
    '',
    'Hard constraints on the question:',
    '• ≤ 25 words. Single question only.',
    '• Quote the unclear word/phrase verbatim.',
    '• Do NOT restate context, do NOT recap the brief, do NOT add preamble.',
    '• Format example: `You said "lightweight" — what bundle-size or perf target?`',
    '',
    'Only probe if a competent developer would be blocked without the answer. Otherwise return clarification_needed=false.',
    'Skip pedantic nitpicks. Don\'t probe stylistic preferences.',
    '',
    'Reply with JSON ONLY: {"clarification_needed": boolean, "follow_up"?: string, "unclear_phrase"?: string}',
  ].join('\n');

  const briefSummary = JSON.stringify(
    {
      title: ctx.brief.title,
      type: ctx.brief.type,
      task_kind: ctx.brief.devKind ?? null,
      description: ctx.brief.description,
      expected_output: ctx.brief.expectedOutput,
    },
    null,
    2,
  );

  const userPrompt =
    `Brief so far:\n${briefSummary}\n\n` +
    `Field under review: ${fieldLabel}.\n` +
    (ctx.history.length > 0
      ? `Already probed once — only probe again if a major gap remains.\n`
      : '') +
    `Decide: clarify or move on.`;

  const result = await chatGroqJson<ProbeResponse>(
    [
      { role: 'system', content: system },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0.2, maxTokens: 200 },
  );

  if (result.stub) return null; // No real Groq — skip probing gracefully
  const parsed = result.data;
  if (!parsed || !parsed.clarification_needed || !parsed.follow_up) return null;

  return {
    followUp: parsed.follow_up.trim(),
    unclearPhrase: parsed.unclear_phrase?.trim() ?? null,
  };
}
