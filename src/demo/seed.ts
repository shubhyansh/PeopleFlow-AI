/**
 * Seed data for the browser demo.
 *
 * Rows are in database shape (snake_case) on purpose: the demo feeds the
 * transport layer, so `src/services/supabase/*` does the row mapping exactly
 * as it does against a real Postgres.
 *
 * Dates are computed relative to load time rather than hardcoded, so the
 * board never drifts into looking abandoned.
 */

import type { Row } from './memoryDb';

const DAY = 86_400_000;

function at(offsetDays: number, hour = 10, minute = 0): string {
  const d = new Date(Date.now() + offsetDays * DAY);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/* ------------------------------------------------------------------ people */

const PEOPLE: Array<[string, string, string, string, string, number]> = [
  ['u-priya', 'priya', 'Priya Raman', 'Engineering Lead', 'Owns the checkout rewrite. Ex-payments.', -95],
  ['u-daniel', 'daniel', 'Daniel Okoye', 'Senior Backend Engineer', 'Postgres, queues, and anything that has to stay up.', -88],
  ['u-mei', 'mei', 'Mei Tanaka', 'Frontend Engineer', 'Design systems, accessibility, and stubborn CSS.', -74],
  ['u-arjun', 'arjun', 'Arjun Nair', 'Full-stack Engineer', 'Joined from the platform team. Likes small PRs.', -61],
  ['u-sofia', 'sofia', 'Sofia Almeida', 'QA Engineer', 'Writes the test that finds the bug you shipped.', -47],
  ['u-tom', 'tom', 'Tom Bergstrom', 'DevOps Engineer', 'Pipelines, images, and the pager.', -33],
];

export const users: Row[] = PEOPLE.map(
  ([id, username, name, designation, description, created]) => ({
    id,
    username,
    // Null means "first login sets the password" -- the real behaviour of
    // flowdeskAuth, and how the demo lets you sign in as any teammate.
    password_hash: null,
    name,
    role: 'employee',
    designation,
    description,
    created_at: at(created),
  }),
);

/* ----------------------------------------------------------------- clients */

export const clients: Row[] = [
  { id: 'c-northwind', name: 'Northwind Retail', created_at: at(-120) },
  { id: 'c-vantage', name: 'Vantage Health', created_at: at(-110) },
  { id: 'c-internal', name: 'Internal', created_at: at(-100) },
];

/* ---------------------------------------------------------------- projects */

export const projects: Row[] = [
  {
    id: 'p-checkout',
    name: 'Checkout Revamp',
    client_id: 'c-northwind',
    lead_id: 'u-priya',
    member_ids: ['u-priya', 'u-mei', 'u-daniel', 'u-sofia'],
    created_at: at(-84),
  },
  {
    id: 'p-portal',
    name: 'Patient Portal',
    client_id: 'c-vantage',
    lead_id: 'u-daniel',
    member_ids: ['u-daniel', 'u-arjun', 'u-sofia'],
    created_at: at(-70),
  },
  {
    id: 'p-platform',
    name: 'Platform Hardening',
    client_id: 'c-internal',
    lead_id: null,
    member_ids: ['u-tom', 'u-arjun'],
    created_at: at(-52),
  },
];

/* ------------------------------------------------------------------- tasks */

interface TaskSpec {
  id: string;
  title: string;
  type: 'leadership' | 'development';
  devKind?: string;
  projectId: string | null;
  clientId: string | null;
  assigneeId: string;
  assignerId: string;
  status: string;
  brief: string;
  expectedOutput: string;
  techStack: string[];
  estimatedDays: number;
  createdOffset: number;
  acceptedOffset?: number;
  completedOffset?: number;
  deadlineOffset?: number;
  sequenceIndex: number;
  parallelWith?: string[];
  timeline: Array<{ offset: number; by: string; kind: string; note?: string }>;
}

const TASKS: TaskSpec[] = [
  {
    id: 't-checkout-lead',
    title: 'Lead the checkout revamp through Q3',
    type: 'leadership',
    projectId: 'p-checkout',
    clientId: 'c-northwind',
    assigneeId: 'u-priya',
    assignerId: 'admin',
    status: 'active',
    brief: [
      '## Project plan / milestones',
      'Three milestones: payment-method refactor, guest checkout, then the address book. Each ends with a demo to Northwind.',
      '',
      '## Team responsibilities',
      'Mei owns the front end, Daniel the payment service, Sofia the regression pack. You own sequencing and the client call.',
      '',
      '## Risks & dependencies',
      "Northwind's PSP migration lands mid-quarter and we cannot control that date. Assume one slipped week.",
      '',
      '## Success metrics',
      'Checkout completion rate up 4 points; p95 confirm latency under 800ms.',
    ].join('\n'),
    expectedOutput: 'A shipped checkout flow behind a flag, plus a written handover for support.',
    techStack: ['React', 'TypeScript', 'Postgres', 'Stripe'],
    estimatedDays: 60,
    createdOffset: -42,
    acceptedOffset: -41,
    deadlineOffset: 26,
    sequenceIndex: 0,
    timeline: [
      { offset: -42, by: 'admin', kind: 'status-change', note: 'Task created and assigned.' },
      { offset: -41, by: 'u-priya', kind: 'accepted', note: 'Accepted. Kickoff booked for Monday.' },
    ],
  },
  {
    id: 't-guest-checkout',
    title: 'Guest checkout without an account',
    type: 'development',
    devKind: 'frontend',
    projectId: 'p-checkout',
    clientId: 'c-northwind',
    assigneeId: 'u-mei',
    assignerId: 'u-priya',
    status: 'active',
    brief: [
      '## Scope of work',
      'A guest lane on the checkout page: email plus shipping, no password. Convert to a full account after payment if the shopper opts in.',
      '',
      '## Constraints',
      'Keyboard reachable end to end, and the lane must not add a render blocking request. Budget is 8KB gzipped over the current bundle.',
      '',
      '## Edge cases',
      'Existing email with a saved account, expired session mid-payment, and the back button after the confirm step.',
      '',
      '## Acceptance criteria',
      'A shopper can buy without an account, the flag flips cleanly, and axe reports no new violations.',
      '',
      '## Notes',
      '- You said "lightweight" -- capped at 8KB gzipped over the current checkout bundle.',
    ].join('\n'),
    expectedOutput: 'Guest lane behind the `checkout_guest` flag, with tests for the three edge cases.',
    techStack: ['React', 'TypeScript', 'Tailwind'],
    estimatedDays: 9,
    createdOffset: -16,
    acceptedOffset: -15,
    deadlineOffset: 5,
    sequenceIndex: 0,
    timeline: [
      { offset: -16, by: 'u-priya', kind: 'status-change', note: 'Task created and assigned.' },
      { offset: -15, by: 'u-mei', kind: 'accepted', note: 'Accepted.' },
      { offset: -6, by: 'u-mei', kind: 'comment', note: 'Guest lane renders; wiring the opt-in conversion next.' },
    ],
  },
  {
    id: 't-address-book',
    title: 'Address book with validation',
    type: 'development',
    devKind: 'frontend',
    projectId: 'p-checkout',
    clientId: 'c-northwind',
    assigneeId: 'u-mei',
    assignerId: 'u-priya',
    status: 'pending',
    brief: [
      '## Scope of work',
      'Saved addresses on the account page, reusable from checkout. Add, edit, delete, set default.',
      '',
      '## Constraints',
      'Validation runs client side first, then against the PSP on submit. No third party autocomplete.',
      '',
      '## Edge cases',
      'Deleting the default address, and an address the PSP rejects after it was saved.',
      '',
      '## Acceptance criteria',
      'Addresses persist, checkout can select one, and a rejected address surfaces the PSP reason inline.',
    ].join('\n'),
    expectedOutput: 'Address CRUD plus checkout selection, with the rejected-address path covered.',
    techStack: ['React', 'TypeScript', 'Postgres'],
    estimatedDays: 6,
    createdOffset: -4,
    deadlineOffset: 16,
    sequenceIndex: 1,
    timeline: [
      { offset: -4, by: 'u-priya', kind: 'status-change', note: 'Queued behind guest checkout.' },
    ],
  },
  {
    id: 't-payment-service',
    title: 'Split the payment service off the monolith',
    type: 'development',
    devKind: 'backend',
    projectId: 'p-checkout',
    clientId: 'c-northwind',
    assigneeId: 'u-daniel',
    assignerId: 'u-priya',
    status: 'blocked',
    brief: [
      '## Scope of work',
      'Move payment intent creation, capture and refund behind their own service with an explicit HTTP contract.',
      '',
      '## API contracts',
      'POST /intents, POST /intents/:id/capture, POST /refunds. Idempotency key required on all three.',
      '',
      '## Constraints',
      'No dual writes. The monolith reads through the new service from day one.',
      '',
      '## Acceptance criteria',
      'All three endpoints live behind the flag, with the refund path replayed against last quarter of production traffic.',
    ].join('\n'),
    expectedOutput: 'A deployed payment service and a monolith that no longer talks to the PSP directly.',
    techStack: ['Node.js', 'Postgres', 'Docker'],
    estimatedDays: 14,
    createdOffset: -24,
    acceptedOffset: -23,
    deadlineOffset: 9,
    sequenceIndex: 0,
    timeline: [
      { offset: -24, by: 'u-priya', kind: 'status-change', note: 'Task created and assigned.' },
      { offset: -23, by: 'u-daniel', kind: 'accepted', note: 'Accepted.' },
      {
        offset: -5,
        by: 'u-daniel',
        kind: 'blocker',
        note: "Northwind's PSP sandbox rejects idempotency keys over 64 chars. Waiting on their support ticket before I can finish refunds.",
      },
    ],
  },
  {
    id: 't-webhook-retry',
    title: 'Retry PSP webhooks with a backoff',
    type: 'development',
    devKind: 'backend',
    projectId: 'p-checkout',
    clientId: 'c-northwind',
    assigneeId: 'u-daniel',
    assignerId: 'u-priya',
    status: 'parallel',
    brief: [
      '## Scope of work',
      'A durable retry queue for PSP webhooks with exponential backoff and a dead letter table.',
      '',
      '## API contracts',
      'Internal only. The handler must stay idempotent per event id.',
      '',
      '## Constraints',
      'At most six attempts across 24 hours; nothing may be dropped silently.',
      '',
      '## Acceptance criteria',
      'A forced failure replays and lands, and the dead letter table is queryable from the admin.',
    ].join('\n'),
    expectedOutput: 'Retry queue plus dead letter table, with a runbook entry for draining it.',
    techStack: ['Node.js', 'Postgres'],
    estimatedDays: 5,
    createdOffset: -12,
    acceptedOffset: -11,
    deadlineOffset: 7,
    sequenceIndex: 1,
    parallelWith: ['t-payment-service'],
    timeline: [
      { offset: -12, by: 'u-priya', kind: 'status-change', note: 'Task created and assigned.' },
      { offset: -11, by: 'u-daniel', kind: 'accepted', note: 'Accepted -- running alongside the service split.' },
    ],
  },
  {
    id: 't-portal-lead',
    title: 'Lead the patient portal build',
    type: 'leadership',
    projectId: 'p-portal',
    clientId: 'c-vantage',
    assigneeId: 'u-daniel',
    assignerId: 'admin',
    status: 'active',
    brief: [
      '## Project plan / milestones',
      'Records view first, then appointments, then secure messaging. Vantage signs off each one.',
      '',
      '## Team responsibilities',
      'Arjun on the portal front end, Sofia on the audit trail tests, you on the integration contract.',
      '',
      '## Risks & dependencies',
      "Vantage's HL7 feed is read-only until their vendor opens writes. Messaging cannot start before that.",
      '',
      '## Success metrics',
      'Sign-off on all three milestones with no open severity-1 findings.',
    ].join('\n'),
    expectedOutput: 'Three signed-off milestones and an integration contract Vantage has agreed to in writing.',
    techStack: ['React', 'Node.js', 'Postgres'],
    estimatedDays: 45,
    createdOffset: -35,
    acceptedOffset: -34,
    deadlineOffset: 31,
    sequenceIndex: 2,
    timeline: [
      { offset: -35, by: 'admin', kind: 'status-change', note: 'Task created and assigned.' },
      { offset: -34, by: 'u-daniel', kind: 'accepted', note: 'Accepted.' },
    ],
  },
  {
    id: 't-records-view',
    title: 'Patient records view',
    type: 'development',
    devKind: 'frontend',
    projectId: 'p-portal',
    clientId: 'c-vantage',
    assigneeId: 'u-arjun',
    assignerId: 'u-daniel',
    status: 'completed',
    brief: [
      '## Scope of work',
      'A read-only records view: visits, prescriptions, lab results, filtered by date.',
      '',
      '## Constraints',
      'Nothing is cached to disk. Every read is written to the audit trail.',
      '',
      '## Edge cases',
      'A patient with no records, and a lab result that arrives without a reference range.',
      '',
      '## Acceptance criteria',
      'All three record types render, the empty state is explicit, and every read appears in the audit trail.',
    ].join('\n'),
    expectedOutput: 'Records view shipped with the audit trail wired and the empty state designed.',
    techStack: ['React', 'TypeScript'],
    estimatedDays: 8,
    createdOffset: -30,
    acceptedOffset: -29,
    completedOffset: -18,
    deadlineOffset: -19,
    sequenceIndex: 0,
    timeline: [
      { offset: -30, by: 'u-daniel', kind: 'status-change', note: 'Task created and assigned.' },
      { offset: -29, by: 'u-arjun', kind: 'accepted', note: 'Accepted.' },
      { offset: -18, by: 'u-arjun', kind: 'completed', note: 'Shipped. Audit trail verified against Vantage staging.' },
    ],
  },
  {
    id: 't-appointments',
    title: 'Appointment booking against the HL7 feed',
    type: 'development',
    devKind: 'api',
    projectId: 'p-portal',
    clientId: 'c-vantage',
    assigneeId: 'u-arjun',
    assignerId: 'u-daniel',
    status: 'active',
    brief: [
      '## Scope of work',
      'Book, reschedule and cancel appointments through the HL7 bridge.',
      '',
      '## Auth + secrets',
      "Bridge credentials stay server side. The portal never sees Vantage's token.",
      '',
      '## Data mapping',
      'Their `SCH` segment maps to our appointment row; the provider id needs a lookup table.',
      '',
      '## Acceptance criteria',
      'All three operations round-trip against Vantage staging, including the double-booking rejection.',
    ].join('\n'),
    expectedOutput: 'Booking flow live against staging with the mapping table documented.',
    techStack: ['Node.js', 'TypeScript', 'Postgres'],
    estimatedDays: 11,
    createdOffset: -17,
    acceptedOffset: -16,
    deadlineOffset: 4,
    sequenceIndex: 1,
    timeline: [
      { offset: -17, by: 'u-daniel', kind: 'status-change', note: 'Task created and assigned.' },
      { offset: -16, by: 'u-arjun', kind: 'accepted', note: 'Accepted.' },
      {
        offset: -9,
        by: 'u-arjun',
        kind: 'blocker',
        note: 'Provider id lookup is missing three clinics.',
      },
      {
        offset: -7,
        by: 'u-daniel',
        kind: 'blocker-resolved',
        note: 'Vantage sent the full clinic list. Deadline extended by the two days lost.',
      },
    ],
  },
  {
    id: 't-audit-pack',
    title: 'Regression pack for the audit trail',
    type: 'development',
    devKind: 'testing',
    projectId: 'p-portal',
    clientId: 'c-vantage',
    assigneeId: 'u-sofia',
    assignerId: 'u-daniel',
    status: 'active',
    brief: [
      '## Coverage targets',
      'Every read path that touches patient data writes exactly one audit row. Cover the three record types plus appointments.',
      '',
      '## Tooling',
      'Playwright against staging, run in CI on every PR that touches the portal.',
      '',
      '## Edge cases',
      'Concurrent reads from two sessions, and a read that fails after the audit row is written.',
      '',
      '## Acceptance criteria',
      'The pack fails when the audit write is removed. That is the test that matters.',
    ].join('\n'),
    expectedOutput: 'A CI-wired regression pack that catches a missing audit write.',
    techStack: ['Playwright', 'TypeScript'],
    estimatedDays: 7,
    createdOffset: -13,
    acceptedOffset: -12,
    deadlineOffset: 6,
    sequenceIndex: 0,
    timeline: [
      { offset: -13, by: 'u-daniel', kind: 'status-change', note: 'Task created and assigned.' },
      { offset: -12, by: 'u-sofia', kind: 'accepted', note: 'Accepted.' },
    ],
  },
  {
    id: 't-checkout-regression',
    title: 'Checkout regression suite',
    type: 'development',
    devKind: 'testing',
    projectId: 'p-checkout',
    clientId: 'c-northwind',
    assigneeId: 'u-sofia',
    assignerId: 'u-priya',
    status: 'requirements-addition',
    brief: [
      '## Coverage targets',
      'Card, wallet and guest lanes, plus the refund path once the payment service lands.',
      '',
      '## Tooling',
      'Playwright, sharded, under eight minutes wall clock.',
      '',
      '## Edge cases',
      'Payment declined at capture, and a session that expires between confirm and redirect.',
      '',
      '## Acceptance criteria',
      'Suite is green on main and gates the checkout flag.',
    ].join('\n'),
    expectedOutput: 'A sharded suite under eight minutes that gates the checkout flag.',
    techStack: ['Playwright', 'TypeScript'],
    estimatedDays: 6,
    createdOffset: -10,
    acceptedOffset: -9,
    deadlineOffset: 8,
    sequenceIndex: 1,
    timeline: [
      { offset: -10, by: 'u-priya', kind: 'status-change', note: 'Task created and assigned.' },
      { offset: -9, by: 'u-sofia', kind: 'accepted', note: 'Accepted.' },
      {
        offset: -2,
        by: 'u-priya',
        kind: 'requirement-edit',
        note: 'Added the wallet lane -- Northwind turned Apple Pay on last week.',
      },
    ],
  },
  {
    id: 't-ci-images',
    title: 'Pin and rebuild the CI base images',
    type: 'development',
    devKind: 'devops',
    projectId: 'p-platform',
    clientId: 'c-internal',
    assigneeId: 'u-tom',
    assignerId: 'admin',
    status: 'active',
    brief: [
      '## Scope of work',
      'Pin every CI base image by digest and set up a weekly rebuild that runs the smoke suite before promoting.',
      '',
      '## Environments',
      'Applies to CI only. Production images are a separate task.',
      '',
      '## Rollout + rollback',
      'Promote by moving a tag; roll back by moving it back. No rebuild on rollback.',
      '',
      '## Acceptance criteria',
      'No unpinned image references remain, and the weekly job has run green twice.',
    ].join('\n'),
    expectedOutput: 'Digest-pinned images plus a weekly rebuild job that has proven itself twice.',
    techStack: ['Docker', 'GitHub Actions'],
    estimatedDays: 5,
    createdOffset: -8,
    acceptedOffset: -8,
    deadlineOffset: 3,
    sequenceIndex: 0,
    timeline: [
      { offset: -8, by: 'admin', kind: 'status-change', note: 'Task created and assigned.' },
      { offset: -8, by: 'u-tom', kind: 'accepted', note: 'Accepted.' },
    ],
  },
  {
    id: 't-secret-rotation',
    title: 'Rotate deploy secrets onto OIDC',
    type: 'development',
    devKind: 'devops',
    projectId: 'p-platform',
    clientId: 'c-internal',
    assigneeId: 'u-tom',
    assignerId: 'admin',
    status: 'on-hold',
    brief: [
      '## Scope of work',
      'Replace the long lived deploy keys with short lived OIDC credentials.',
      '',
      '## Environments',
      'Staging first, production only after two clean weeks.',
      '',
      '## Rollout + rollback',
      'Both credential paths stay live during the overlap, with the old keys revoked at the end.',
      '',
      '## Acceptance criteria',
      'No static deploy key remains in any repository secret.',
    ].join('\n'),
    expectedOutput: 'OIDC deploys on staging and production, with the old keys revoked.',
    techStack: ['GitHub Actions', 'Terraform'],
    estimatedDays: 4,
    createdOffset: -6,
    deadlineOffset: 14,
    sequenceIndex: 1,
    timeline: [
      { offset: -6, by: 'admin', kind: 'status-change', note: 'Task created and assigned.' },
      {
        offset: -3,
        by: 'admin',
        kind: 'status-change',
        note: 'On hold until the CI image work lands -- they touch the same workflows.',
      },
    ],
  },
];

export const tasks: Row[] = TASKS.map((t, index) => ({
  id: t.id,
  title: t.title,
  type: t.type,
  dev_kind: t.devKind ?? null,
  project_id: t.projectId,
  client_id: t.clientId,
  assignee_id: t.assigneeId,
  assigner_id: t.assignerId,
  status: t.status,
  brief: t.brief,
  expected_output: t.expectedOutput,
  attachments: [],
  tech_stack: t.techStack,
  estimated_days: t.estimatedDays,
  deadline: t.deadlineOffset === undefined ? null : at(t.deadlineOffset, 18),
  created_at: at(t.createdOffset, 9, index),
  accepted_at: t.acceptedOffset === undefined ? null : at(t.acceptedOffset, 11),
  completed_at: t.completedOffset === undefined ? null : at(t.completedOffset, 16),
  parallel_with: t.parallelWith ?? [],
  sequence_index: t.sequenceIndex,
  timeline: t.timeline.map((entry, i) => ({
    id: `${t.id}-tl-${i}`,
    at: at(entry.offset, 12, i),
    byUserId: entry.by,
    kind: entry.kind,
    ...(entry.note ? { note: entry.note } : {}),
  })),
}));

export const seed: Record<string, Row[]> = { users, clients, projects, tasks };
