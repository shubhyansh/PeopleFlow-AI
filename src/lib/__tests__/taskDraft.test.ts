import { describe, expect, it } from 'vitest';
import { buildTaskDraft, leadershipAssignment, type TaskDraftInput } from '../taskDraft';
import type { TaskAttachment } from '../../domain/types';
import { briefFixture } from './fixtures';

const ATTACHMENT: TaskAttachment = {
  id: 'a-1',
  kind: 'note',
  name: 'Load-test numbers',
  description: 'Baseline before the cap',
  body: 'p95 queue wait 41s at 200 rps',
};

function draftInput(overrides: Partial<TaskDraftInput> = {}): TaskDraftInput {
  return {
    brief: briefFixture(),
    assigneeId: 'u-asha',
    assignerId: 'u-admin',
    attachments: [ATTACHMENT],
    sequenceIndex: 3,
    id: 't-0001',
    createdAt: '2026-08-26T06:30:00.000Z',
    ...overrides,
  };
}

describe('buildTaskDraft', () => {
  it('is deterministic — identical input produces an identical row', () => {
    expect(buildTaskDraft(draftInput())).toEqual(buildTaskDraft(draftInput()));
  });

  it('uses the injected id, timestamp and sequence index verbatim', () => {
    const task = buildTaskDraft(draftInput());

    expect(task.id).toBe('t-0001');
    expect(task.createdAt).toBe('2026-08-26T06:30:00.000Z');
    expect(task.sequenceIndex).toBe(3);
  });

  it('opens the task pending, unparallelised and with an empty timeline', () => {
    const task = buildTaskDraft(draftInput());

    expect(task.status).toBe('pending');
    expect(task.parallelWith).toEqual([]);
    expect(task.timeline).toEqual([]);
  });

  it('trims the title and expected output', () => {
    const task = buildTaskDraft(
      draftInput({
        brief: briefFixture({
          title: '   Rate-limit the export endpoint  ',
          expectedOutput: '\n  A merged PR.\n',
        }),
      }),
    );

    expect(task.title).toBe('Rate-limit the export endpoint');
    expect(task.expectedOutput).toBe('A merged PR.');
  });

  it('omits optional columns rather than writing null — Supabase upsert treats them differently', () => {
    const task = buildTaskDraft(
      draftInput({ brief: briefFixture({ devKind: null, projectId: null, clientId: null }) }),
    );

    expect('devKind' in task).toBe(false);
    expect('projectId' in task).toBe(false);
    expect('clientId' in task).toBe(false);
  });

  it('keeps optional columns when the brief carries them', () => {
    const task = buildTaskDraft(draftInput());

    expect(task.devKind).toBe('backend');
    expect(task.projectId).toBe('p-atlas');
    expect(task.clientId).toBe('c-north');
  });

  it('falls back to development when the brief never picked a type', () => {
    const task = buildTaskDraft(draftInput({ brief: briefFixture({ type: null }) }));

    expect(task.type).toBe('development');
  });

  it('composes the markdown brief from the overview, outline sections and notes', () => {
    const task = buildTaskDraft(draftInput());

    expect(task.brief).toContain('## Overview');
    expect(task.brief).toContain('## Scope');
    expect(task.brief).toContain('Token bucket in front of `/api/export`.');
    expect(task.brief).toContain('## Notes');
    expect(task.brief).toContain('p95 queue wait above 30s');
  });

  it('passes attachments and tech stack straight through', () => {
    const task = buildTaskDraft(draftInput());

    expect(task.attachments).toEqual([ATTACHMENT]);
    expect(task.techStack).toEqual(['TypeScript', 'Postgres']);
  });

  it('records who assigned the task and to whom', () => {
    const task = buildTaskDraft(draftInput());

    expect(task.assigneeId).toBe('u-asha');
    expect(task.assignerId).toBe('u-admin');
  });
});

describe('leadershipAssignment', () => {
  it('returns nothing for a development task', () => {
    expect(leadershipAssignment(briefFixture())).toBeNull();
  });

  it('returns the project membership rewrite for a complete leadership brief', () => {
    const assignment = leadershipAssignment(
      briefFixture({
        type: 'leadership',
        projectId: 'p-atlas',
        leadId: 'u-asha',
        memberIds: ['u-asha', 'u-rohit'],
      }),
    );

    expect(assignment).toEqual({
      projectId: 'p-atlas',
      leadId: 'u-asha',
      memberIds: ['u-asha', 'u-rohit'],
    });
  });

  it('returns nothing when a leadership brief has no lead picked yet', () => {
    const assignment = leadershipAssignment(
      briefFixture({ type: 'leadership', projectId: 'p-atlas', leadId: null }),
    );

    expect(assignment).toBeNull();
  });

  it('returns nothing when a leadership brief has no project', () => {
    const assignment = leadershipAssignment(
      briefFixture({ type: 'leadership', projectId: null, leadId: 'u-asha' }),
    );

    expect(assignment).toBeNull();
  });
});
