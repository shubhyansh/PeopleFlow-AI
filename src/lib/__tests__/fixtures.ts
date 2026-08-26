import type { InterviewBrief, ParsedReqMd } from '../taskInterview';
import { INITIAL_BRIEF } from '../taskInterview';
import type { Client, Project, User } from '../../domain/types';

/**
 * Shared directory fixtures. Two projects under two different clients, so a
 * test can tell an inherited client apart from a matched one.
 */
export const CLIENTS: Client[] = [
  { id: 'c-north', name: 'Northwind' },
  { id: 'c-acme', name: 'Acme Robotics' },
];

export const PROJECTS: Project[] = [
  {
    id: 'p-atlas',
    name: 'Atlas',
    clientId: 'c-north',
    memberIds: ['u-asha'],
    createdAt: '2026-01-04T09:00:00.000Z',
  },
  {
    id: 'p-borealis',
    name: 'Borealis',
    clientId: 'c-acme',
    memberIds: ['u-rohit'],
    createdAt: '2026-02-11T09:00:00.000Z',
  },
];

export const USERS: User[] = [
  {
    id: 'u-asha',
    username: 'asha',
    passwordHash: null,
    name: 'Asha Nair',
    role: 'employee',
    designation: 'Backend Engineer',
    description: '',
    createdAt: '2026-01-02T09:00:00.000Z',
  },
  {
    id: 'u-rohit',
    username: 'rohit',
    passwordHash: null,
    name: 'Rohit Menon',
    role: 'employee',
    designation: 'Frontend Engineer',
    description: '',
    createdAt: '2026-01-02T09:00:00.000Z',
  },
];

/** A parsed `.req.md` with every required field filled and nothing matched yet. */
export function parsedFixture(overrides: Partial<ParsedReqMd> = {}): ParsedReqMd {
  return {
    title: 'Rate-limit the export endpoint',
    type: 'development',
    devKind: 'backend',
    projectName: 'Atlas',
    clientName: 'Northwind',
    assigneeName: 'Asha Nair',
    shortDescription: 'Exports can be triggered in a loop and starve the worker pool.',
    expectedOutput: 'A merged PR plus a load-test run showing the cap holds.',
    techStack: ['TypeScript', 'Postgres'],
    outline: { sections: [{ key: 'scope', title: 'Scope' }] },
    sections: { scope: 'Token bucket in front of `/api/export`.' },
    notes: [{ phrase: 'starve', answer: 'p95 queue wait above 30s' }],
    ...overrides,
  };
}

/** A finished interview brief, ready for `buildTaskDraft`. */
export function briefFixture(overrides: Partial<InterviewBrief> = {}): InterviewBrief {
  return {
    ...INITIAL_BRIEF,
    type: 'development',
    devKind: 'backend',
    projectId: 'p-atlas',
    projectName: 'Atlas',
    clientId: 'c-north',
    clientName: 'Northwind',
    title: 'Rate-limit the export endpoint',
    shortDescription: 'Exports can be triggered in a loop and starve the worker pool.',
    expectedOutput: 'A merged PR plus a load-test run showing the cap holds.',
    outline: { sections: [{ key: 'scope', title: 'Scope' }] },
    sections: { scope: 'Token bucket in front of `/api/export`.' },
    notes: [{ phrase: 'starve', answer: 'p95 queue wait above 30s' }],
    techStack: ['TypeScript', 'Postgres'],
    ...overrides,
  };
}
