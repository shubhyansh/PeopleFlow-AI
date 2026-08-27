import { describe, expect, it } from 'vitest';
import { scriptedGroqChat } from '../groqScript';
import type { GroqMessage } from '@shared/ipc-contract';

/** The system prompt the outline generator sends, trimmed to what the script keys on. */
const OUTLINE_SYSTEM =
  'Given the task title + a 1-3 sentence opening description, produce a checklist of 3 to 6 sections to fill in.';

const PROBE_SYSTEM =
  'Reply with JSON ONLY: {"clarification_needed": boolean, "follow_up"?: string, "unclear_phrase"?: string}';

function ask(system: string, user: string): unknown {
  const messages: GroqMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
  return JSON.parse(scriptedGroqChat({ messages }).content);
}

function outline(user: string): { sections: Array<{ key: string; title: string }> } {
  return ask(OUTLINE_SYSTEM, user) as { sections: Array<{ key: string; title: string }> };
}

function probe(user: string): {
  clarification_needed: boolean;
  follow_up?: string;
  unclear_phrase?: string;
} {
  return ask(PROBE_SYSTEM, user) as {
    clarification_needed: boolean;
    follow_up?: string;
    unclear_phrase?: string;
  };
}

describe('scripted outline', () => {
  it('returns between three and six sections with keys and titles', () => {
    const result = outline('Title: Fix the login redirect\nOpening description: It loops.\nType: development, kind: bug');
    expect(result.sections.length).toBeGreaterThanOrEqual(3);
    expect(result.sections.length).toBeLessThanOrEqual(6);
    for (const section of result.sections) {
      expect(section.key).toMatch(/^[a-z0-9-]+$/);
      expect(section.title.length).toBeGreaterThan(0);
    }
  });

  it('picks the checklist that matches the task kind', () => {
    const bug = outline('Title: Crash on save\nOpening description: Boom.\nType: development, kind: bug');
    expect(bug.sections.map((s) => s.key)).toContain('repro');

    const backend = outline('Title: New service\nOpening description: Split it.\nType: development, kind: backend');
    expect(backend.sections.map((s) => s.key)).toContain('contracts');
  });

  it('uses the leadership checklist for a leadership task', () => {
    const result = outline('Title: Run the migration\nOpening description: Own it.\nType: leadership');
    expect(result.sections.map((s) => s.key)).toContain('metrics');
    expect(result.sections.map((s) => s.key)).not.toContain('repro');
  });

  it('adds a topic section when the description raises it', () => {
    const result = outline(
      'Title: New settings page\nOpening description: Must be reachable by keyboard for screen reader users.\nType: development, kind: frontend',
    );
    expect(result.sections.map((s) => s.key)).toContain('a11y');
  });

  it('keeps acceptance criteria last when a topic section is added', () => {
    const result = outline(
      'Title: New settings page\nOpening description: Keyboard accessible.\nType: development, kind: frontend',
    );
    expect(result.sections.at(-1)?.key).toBe('acceptance');
  });

  it('never exceeds six sections however many topics match', () => {
    const result = outline(
      'Title: Everything\nOpening description: accessibility migration auth perf flag analytics all at once.\nType: development, kind: frontend',
    );
    expect(result.sections.length).toBeLessThanOrEqual(6);
  });

  it('is deterministic', () => {
    const user = 'Title: Same\nOpening description: Same.\nType: development, kind: api';
    expect(outline(user)).toEqual(outline(user));
  });

  it('falls back to the generic checklist for an unknown kind', () => {
    const result = outline('Title: Odd\nOpening description: Odd.\nType: development, kind: astrology');
    expect(result.sections.map((s) => s.key)).toContain('scope');
  });
});

describe('scripted clarifier', () => {
  it('quotes the vague word back in the question', () => {
    const result = probe('Brief so far:\n{"description":"make it lightweight"}\nField under review: Scope.');
    expect(result.clarification_needed).toBe(true);
    expect(result.unclear_phrase).toBe('lightweight');
    expect(result.follow_up).toContain('"lightweight"');
  });

  it('stays under the 25-word ceiling the prompt asks for', () => {
    const result = probe('Brief so far:\n{"description":"needs to be scalable"}\nField under review: Scope.');
    expect(result.follow_up?.split(/\s+/).length).toBeLessThanOrEqual(25);
  });

  it('says nothing when the brief is already specific', () => {
    const result = probe(
      'Brief so far:\n{"description":"p95 under 800ms measured at the edge"}\nField under review: Scope.',
    );
    expect(result.clarification_needed).toBe(false);
    expect(result.follow_up).toBeUndefined();
  });

  it('does not probe twice in one interview', () => {
    const result = probe(
      'Brief so far:\n{"description":"make it lightweight"}\nAlready probed once -- only probe again if a major gap remains.\nField under review: Scope.',
    );
    expect(result.clarification_needed).toBe(false);
  });
});

describe('anything else', () => {
  it('answers a plain ping with a line that says it is a demo', () => {
    const response = scriptedGroqChat({ messages: [{ role: 'user', content: 'ping' }] });
    expect(response.content.toLowerCase()).toContain('demo');
    expect(response.model).toBe('demo-scripted');
  });

  it('never reports itself as a real model', () => {
    const response = scriptedGroqChat({ messages: [{ role: 'user', content: 'ping' }] });
    expect(response.model).not.toMatch(/llama|groq/i);
  });
});
