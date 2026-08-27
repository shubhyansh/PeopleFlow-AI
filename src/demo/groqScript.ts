/**
 * Scripted stand-in for the Groq calls the requirements interview makes.
 *
 * The published demo has no API key and must not have one, so this answers
 * the two JSON probes the interview issues. It is deliberately rule-based
 * rather than random: the same input always produces the same brief, which is
 * what you want from something people click through to evaluate the app.
 *
 * The demo banner says these answers are scripted. Nothing here pretends to
 * be a model.
 */

import type { GroqChatRequest, GroqChatResponse } from '@shared/ipc-contract';

const MODEL = 'demo-scripted';

interface OutlineSection {
  key: string;
  title: string;
  hint?: string;
}

/** Words that make a brief unactionable. Lifted from the probe's own prompt. */
const VAGUE_TERMS: Array<[RegExp, string]> = [
  [/\blightweight\b/i, 'what bundle-size or memory ceiling?'],
  [/\bfast(er)?\b/i, 'what p95 target?'],
  [/\bbetter\b/i, 'better along which axis -- speed, clarity, or conversion?'],
  [/\bmodern\b/i, 'which specific pattern are you asking for?'],
  [/\bscalable\b/i, 'scalable to how many concurrent users?'],
  [/\bsecure\b/i, 'which threat are you defending against?'],
  [/\bclean(er)?\b/i, 'what does clean mean here -- fewer files, or fewer branches?'],
  [/\bintuitive\b/i, 'intuitive for whom, and measured how?'],
  [/\brobust\b/i, 'robust against which failure?'],
  [/\bsoon\b/i, 'by which date?'],
  [/\bsimple\b/i, 'simple for the user or simple to maintain?'],
  [/\bseamless\b/i, 'what would a seam look like, so we know it is gone?'],
];

/** Extra sections offered when the opening description mentions the topic. */
const TOPIC_SECTIONS: Array<[RegExp, OutlineSection]> = [
  [/\b(a11y|accessib|screen reader|keyboard)\b/i, { key: 'a11y', title: 'Accessibility', hint: 'Keyboard path, focus order, announced state.' }],
  [/\b(migrat|backfill|schema)\b/i, { key: 'migration', title: 'Migration plan', hint: 'Backfill, rollout, rollback.' }],
  [/\b(auth|token|secret|credential)\b/i, { key: 'auth', title: 'Auth + secrets', hint: 'Where credentials live; who can read them.' }],
  [/\b(perf|latency|p95|throughput)\b/i, { key: 'perf', title: 'Performance budget', hint: 'The number this must stay under.' }],
  [/\b(flag|rollout|canary)\b/i, { key: 'rollout', title: 'Rollout', hint: 'Flag name, audience, and the kill switch.' }],
  [/\b(analytics|metric|track)\b/i, { key: 'telemetry', title: 'Telemetry', hint: 'Events to emit and who reads them.' }],
];

const BASE_BY_KIND: Record<string, OutlineSection[]> = {
  bug: [
    { key: 'repro', title: 'Reproduction steps', hint: 'Exact steps to trigger it.' },
    { key: 'expected-actual', title: 'Expected vs actual' },
    { key: 'verify', title: 'How to verify the fix', hint: 'The test that fails today.' },
  ],
  frontend: [
    { key: 'scope', title: 'Scope of work', hint: 'Components, pages, interactions.' },
    { key: 'edges', title: 'Edge cases', hint: 'Loading, empty, error.' },
    { key: 'acceptance', title: 'Acceptance criteria', hint: 'Done = ?' },
  ],
  backend: [
    { key: 'scope', title: 'Scope of work', hint: 'Services, data models, jobs.' },
    { key: 'contracts', title: 'API contracts', hint: 'Inputs, outputs, error codes.' },
    { key: 'acceptance', title: 'Acceptance criteria' },
  ],
  api: [
    { key: 'scope', title: 'Scope of work' },
    { key: 'mapping', title: 'Data mapping', hint: 'How their fields map to ours.' },
    { key: 'acceptance', title: 'Acceptance criteria' },
  ],
  database: [
    { key: 'schema', title: 'Schema changes' },
    { key: 'constraints', title: 'Constraints', hint: 'Integrity and query cost.' },
    { key: 'acceptance', title: 'Acceptance criteria' },
  ],
  devops: [
    { key: 'scope', title: 'Scope of work' },
    { key: 'environments', title: 'Environments' },
    { key: 'acceptance', title: 'Acceptance criteria' },
  ],
  testing: [
    { key: 'coverage', title: 'Coverage targets', hint: 'What to test, what to skip.' },
    { key: 'tools', title: 'Tooling' },
    { key: 'acceptance', title: 'Acceptance criteria' },
  ],
  docs: [
    { key: 'audience', title: 'Audience' },
    { key: 'scope', title: 'Scope' },
    { key: 'acceptance', title: 'Acceptance criteria' },
  ],
  leadership: [
    { key: 'plan', title: 'Plan / milestones' },
    { key: 'team', title: 'Team responsibilities' },
    { key: 'risks', title: 'Risks & dependencies' },
    { key: 'metrics', title: 'Success metrics' },
  ],
  other: [
    { key: 'scope', title: 'Scope of work' },
    { key: 'constraints', title: 'Constraints' },
    { key: 'acceptance', title: 'Acceptance criteria' },
  ],
};

function field(text: string, label: string): string {
  const match = new RegExp(`^${label}:\\s*(.*)$`, 'im').exec(text);
  return match ? match[1].trim() : '';
}

function buildOutline(userPrompt: string): string {
  const description = field(userPrompt, 'Opening description');
  const title = field(userPrompt, 'Title');
  const typeLine = field(userPrompt, 'Type');
  const kindMatch = /kind:\s*([a-z-]+)/i.exec(typeLine);
  const kind = typeLine.startsWith('leadership') ? 'leadership' : (kindMatch?.[1] ?? 'other');

  const sections = [...(BASE_BY_KIND[kind] ?? BASE_BY_KIND.other)];
  const haystack = `${title} ${description}`;
  for (const [pattern, section] of TOPIC_SECTIONS) {
    if (sections.length >= 6) break;
    if (pattern.test(haystack) && !sections.some((s) => s.key === section.key)) {
      // Topic sections go before the acceptance criteria, which always reads last.
      const tail = sections.pop();
      sections.push(section);
      if (tail) sections.push(tail);
    }
  }
  return JSON.stringify({ sections });
}

function buildProbe(userPrompt: string): string {
  // The probe prompt carries the brief so far as a JSON blob. Probe once per
  // interview: the second call announces it has already probed.
  if (/Already probed once/i.test(userPrompt)) {
    return JSON.stringify({ clarification_needed: false });
  }
  for (const [pattern, question] of VAGUE_TERMS) {
    const found = pattern.exec(userPrompt);
    if (found) {
      const phrase = found[0];
      return JSON.stringify({
        clarification_needed: true,
        unclear_phrase: phrase,
        follow_up: `You said "${phrase}" -- ${question}`,
      });
    }
  }
  return JSON.stringify({ clarification_needed: false });
}

/** Answers a request the way the Electron main process would, minus the network. */
export function scriptedGroqChat(req: GroqChatRequest): GroqChatResponse {
  const system = req.messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n');
  const user = req.messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join('\n');

  if (/checklist of 3 to 6 sections/i.test(system)) {
    return { content: buildOutline(user), model: MODEL };
  }
  if (/clarification_needed/i.test(system)) {
    return { content: buildProbe(user), model: MODEL };
  }
  return {
    content: 'Demo mode: this build ships without an API key, so brief-writing answers are scripted.',
    model: MODEL,
  };
}
