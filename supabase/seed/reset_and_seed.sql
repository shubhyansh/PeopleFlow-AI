-- FlowDesk: wipe + seed dummy data
-- Paste this entire file into the Supabase SQL editor and run.
-- It clears everything and inserts a comprehensive dataset that exercises
-- every state, role, and visualization the app supports.
--
-- Run AFTER all four migrations (0001–0004) have been applied.
-- Safe to run repeatedly — TRUNCATE … CASCADE wipes a clean slate first.
--
-- ⚠️ Passwords are NULL, so on first login each employee picks their own
--    password (recommended: type "test" for every user during testing).

begin;

-- ---------- WIPE ----------
truncate table public.tasks    restart identity cascade;
truncate table public.projects restart identity cascade;
truncate table public.clients  restart identity cascade;
truncate table public.users    restart identity cascade;

-- ---------- USERS ----------
insert into public.users (id, username, password_hash, name, role, designation, description) values
  ('usr_alice',   'alice',   null, 'Alice Chen',     'employee', 'Senior Frontend Engineer', 'React + UX, leads design-system work.'),
  ('usr_bob',     'bob',     null, 'Bob Martinez',   'employee', 'Backend Engineer',         'Node, Postgres, AWS.'),
  ('usr_carol',   'carol',   null, 'Carol Wong',     'employee', 'Full-stack Engineer',      'Comfortable across the stack.'),
  ('usr_dave',    'dave',    null, 'Dave Patel',     'employee', 'DevOps Engineer',          'CI/CD, Docker, K8s.'),
  ('usr_eve',     'eve',     null, 'Eve Johnson',    'employee', 'QA Engineer',              'Testing strategy + automation.');

-- ---------- CLIENTS ----------
insert into public.clients (id, name) values
  ('cli_acme',    'Acme Corp'),
  ('cli_globex',  'Globex Industries'),
  ('cli_initech', 'Initech');

-- ---------- PROJECTS ----------
-- prj_dashboard  →  Alice leads, Bob + Eve on the team
-- prj_api        →  Bob leads, Carol on the team
-- prj_internal   →  no lead, no team (admin still assigns ad-hoc tasks here)
-- prj_mobile     →  Dave leads, but task is still pending acceptance
insert into public.projects (id, name, client_id, lead_id, member_ids) values
  ('prj_dashboard', 'Dashboard v2',   'cli_acme',    'usr_alice', array['usr_alice','usr_bob','usr_eve']::text[]),
  ('prj_api',       'API Migration',  'cli_globex',  'usr_bob',   array['usr_bob','usr_carol']::text[]),
  ('prj_internal',  'Internal Tools', 'cli_initech', null,        array[]::text[]),
  ('prj_mobile',    'Mobile App',     'cli_acme',    'usr_dave',  array['usr_dave']::text[]);

-- ---------- TASKS ----------
-- Every INSERT names its columns explicitly so Postgres doesn't rely on
-- the physical column order of the tasks table.
--
-- Cover every status: pending / active / parallel / blocked / requirements-addition / on-hold / completed
-- Cover both types: development + leadership
-- Cover both assigners: admin (purple "admin" pill) + lead (no pill)
-- Multiple events per task to exercise the event-chain visualization
-- One task with attachments, one with comments, one with parallel pair, one with deadline-extension via blocker resolution

-- 1. Alice's leadership task (admin → Alice). Active. Includes attachments.
insert into public.tasks (
  id, title, type, dev_kind, project_id, client_id,
  assignee_id, assigner_id, status, brief, expected_output,
  attachments, estimated_days, deadline, created_at, accepted_at, completed_at,
  parallel_with, sequence_index, timeline
) values (
  'tsk_001',
  'Lead Dashboard v2 redesign',
  'leadership',
  null,
  'prj_dashboard',
  'cli_acme',
  'usr_alice',
  'admin',
  'active',
  'Lead the redesign of our customer-facing dashboard. Coordinate with backend on data needs, ship a v2 that handles 10x current load.',
  'Project plan + delegated tasks ready in 2 weeks. Architecture doc reviewed by backend lead.',
  jsonb_build_array(
    jsonb_build_object(
      'id', 'att_001_a',
      'kind', 'note',
      'name', 'Design spec',
      'description', 'Latest mockups + interaction notes from Figma',
      'body', 'Figma: https://figma.com/example/dashboard-v2

Key changes vs v1:
- Larger info cards
- Live filtering on the activity stream
- Dark mode toggle in user settings'
    ),
    jsonb_build_object(
      'id', 'att_001_b',
      'kind', 'note',
      'name', 'Constraints',
      'description', 'Hard limits',
      'body', '- Must be SSR-friendly
- Bundle size budget: 250kB gzipped
- Lighthouse a11y score >= 95'
    )
  )::jsonb,
  14,
  now() + interval '12 days',
  now() - interval '3 days',
  now() - interval '2 days',
  null,
  array[]::text[],
  0,
  jsonb_build_array(
    jsonb_build_object(
      'id', 'tl_001_a',
      'at', now() - interval '2 days',
      'byUserId', 'usr_alice',
      'kind', 'accepted',
      'payload', jsonb_build_object('estimatedDays', 14)
    )
  )::jsonb
);

-- 2. Alice's pending dev task (admin → Alice). Locked behind tsk_001.
insert into public.tasks (
  id, title, type, dev_kind, project_id, client_id,
  assignee_id, assigner_id, status, brief, expected_output,
  attachments, estimated_days, deadline, created_at, accepted_at, completed_at,
  parallel_with, sequence_index, timeline
) values (
  'tsk_002',
  'Refactor authentication module',
  'development',
  'backend',
  null,
  null,
  'usr_alice',
  'admin',
  'pending',
  'Pull session handling out of the request layer into its own module. Add unit tests covering happy path + token refresh + invalid signature.',
  'Auth module + passing tests, callable from any service layer.',
  '[]'::jsonb,
  null,
  null,
  now() - interval '1 day',
  null,
  null,
  array[]::text[],
  1,
  '[]'::jsonb
);

-- 3. Bob's leadership task (admin → Bob). Completed — for "show completed" toggle.
insert into public.tasks (
  id, title, type, dev_kind, project_id, client_id,
  assignee_id, assigner_id, status, brief, expected_output,
  attachments, estimated_days, deadline, created_at, accepted_at, completed_at,
  parallel_with, sequence_index, timeline
) values (
  'tsk_003',
  'Lead API migration kickoff',
  'leadership',
  null,
  'prj_api',
  'cli_globex',
  'usr_bob',
  'admin',
  'completed',
  'Kick off the GraphQL migration. Spec the schema, line up the team, ship the first 3 endpoints.',
  'Approved schema doc + first 3 endpoints (users, orgs, sessions) live in staging.',
  '[]'::jsonb,
  5,
  now() - interval '5 days',
  now() - interval '12 days',
  now() - interval '10 days',
  now() - interval '5 days',
  array[]::text[],
  0,
  jsonb_build_array(
    jsonb_build_object(
      'id', 'tl_003_a', 'at', now() - interval '10 days',
      'byUserId', 'usr_bob', 'kind', 'accepted',
      'payload', jsonb_build_object('estimatedDays', 5)
    ),
    jsonb_build_object(
      'id', 'tl_003_b', 'at', now() - interval '5 days',
      'byUserId', 'usr_bob', 'kind', 'completed'
    )
  )::jsonb
);

-- 4. Bob's dev task (Bob → Bob within his project). Active.
insert into public.tasks (
  id, title, type, dev_kind, project_id, client_id,
  assignee_id, assigner_id, status, brief, expected_output,
  attachments, estimated_days, deadline, created_at, accepted_at, completed_at,
  parallel_with, sequence_index, timeline
) values (
  'tsk_004',
  'Migrate /users endpoint',
  'development',
  'api',
  'prj_api',
  'cli_globex',
  'usr_bob',
  'usr_bob',
  'active',
  'Port the /users REST endpoint to the new GraphQL gateway. Preserve field-level permissions.',
  '/users live in staging via GraphQL with permission tests passing.',
  '[]'::jsonb,
  3,
  now() + interval '3 days',
  now() - interval '5 days',
  now() - interval '4 days',
  null,
  array[]::text[],
  1,
  jsonb_build_array(
    jsonb_build_object(
      'id', 'tl_004_a', 'at', now() - interval '4 days',
      'byUserId', 'usr_bob', 'kind', 'accepted',
      'payload', jsonb_build_object('estimatedDays', 3)
    )
  )::jsonb
);

-- 5. Carol's BLOCKED task (Bob → Carol within Bob's project). Demonstrates blocker flow + paused timer.
insert into public.tasks (
  id, title, type, dev_kind, project_id, client_id,
  assignee_id, assigner_id, status, brief, expected_output,
  attachments, estimated_days, deadline, created_at, accepted_at, completed_at,
  parallel_with, sequence_index, timeline
) values (
  'tsk_005',
  'Set up GraphQL gateway',
  'development',
  'devops',
  'prj_api',
  'cli_globex',
  'usr_carol',
  'usr_bob',
  'blocked',
  'Stand up Apollo gateway routing to the existing services. Wire up telemetry to our datadog account.',
  'Gateway accepting traffic in staging with telemetry visible.',
  '[]'::jsonb,
  4,
  now() + interval '4 days',
  now() - interval '4 days',
  now() - interval '3 days',
  null,
  array[]::text[],
  0,
  jsonb_build_array(
    jsonb_build_object(
      'id', 'tl_005_a', 'at', now() - interval '3 days',
      'byUserId', 'usr_carol', 'kind', 'accepted',
      'payload', jsonb_build_object('estimatedDays', 4)
    ),
    jsonb_build_object(
      'id', 'tl_005_b', 'at', now() - interval '8 hours',
      'byUserId', 'usr_carol', 'kind', 'comment',
      'note', 'Started infra setup, hit an SSL cert issue.'
    ),
    jsonb_build_object(
      'id', 'tl_005_c', 'at', now() - interval '6 hours',
      'byUserId', 'usr_carol', 'kind', 'blocker',
      'note', 'Waiting on infra team to provision the load-balancer SSL cert. Filed ticket INFRA-3421.',
      'payload', jsonb_build_object('previousStatus', 'active')
    )
  )::jsonb
);

-- 6 + 7. Dave's PARALLEL pair (admin → Dave).
insert into public.tasks (
  id, title, type, dev_kind, project_id, client_id,
  assignee_id, assigner_id, status, brief, expected_output,
  attachments, estimated_days, deadline, created_at, accepted_at, completed_at,
  parallel_with, sequence_index, timeline
) values (
  'tsk_006',
  'Set up CI/CD pipeline',
  'development',
  'devops',
  null,
  null,
  'usr_dave',
  'admin',
  'parallel',
  'GitHub Actions workflows for test → build → deploy. Notify Slack on failures.',
  'PR pipeline + main pipeline both running. Slack channel posting on every event.',
  '[]'::jsonb,
  5,
  now() + interval '5 days',
  now() - interval '3 days',
  now() - interval '2 days',
  null,
  array['tsk_007']::text[],
  0,
  jsonb_build_array(
    jsonb_build_object(
      'id', 'tl_006_a', 'at', now() - interval '2 days',
      'byUserId', 'usr_dave', 'kind', 'accepted',
      'payload', jsonb_build_object('estimatedDays', 5)
    ),
    jsonb_build_object(
      'id', 'tl_006_b', 'at', now() - interval '1 day',
      'byUserId', 'usr_dave', 'kind', 'status-change',
      'payload', jsonb_build_object('from', 'active', 'to', 'parallel', 'pairedWith', 'tsk_007')
    )
  )::jsonb
);

insert into public.tasks (
  id, title, type, dev_kind, project_id, client_id,
  assignee_id, assigner_id, status, brief, expected_output,
  attachments, estimated_days, deadline, created_at, accepted_at, completed_at,
  parallel_with, sequence_index, timeline
) values (
  'tsk_007',
  'Containerize the app',
  'development',
  'devops',
  null,
  null,
  'usr_dave',
  'admin',
  'parallel',
  'Dockerize the monolith. Multi-stage build, sub-200MB final image.',
  'Image building cleanly + running in staging behind the new gateway.',
  '[]'::jsonb,
  3,
  now() + interval '3 days',
  now() - interval '2 days',
  now() - interval '1 day',
  null,
  array['tsk_006']::text[],
  0,
  jsonb_build_array(
    jsonb_build_object(
      'id', 'tl_007_a', 'at', now() - interval '1 day',
      'byUserId', 'usr_dave', 'kind', 'accepted',
      'payload', jsonb_build_object('estimatedDays', 3)
    ),
    jsonb_build_object(
      'id', 'tl_007_b', 'at', now() - interval '23 hours',
      'byUserId', 'usr_dave', 'kind', 'status-change',
      'payload', jsonb_build_object('from', 'pending', 'to', 'parallel', 'pairedWith', 'tsk_006')
    )
  )::jsonb
);

-- 8. Eve's REQUIREMENTS-ADDITION task (admin assigned, Alice as lead added requirements).
insert into public.tasks (
  id, title, type, dev_kind, project_id, client_id,
  assignee_id, assigner_id, status, brief, expected_output,
  attachments, estimated_days, deadline, created_at, accepted_at, completed_at,
  parallel_with, sequence_index, timeline
) values (
  'tsk_008',
  'Test plan for Dashboard v2',
  'development',
  'testing',
  'prj_dashboard',
  'cli_acme',
  'usr_eve',
  'usr_alice',
  'requirements-addition',
  'Build a comprehensive test plan covering accessibility + performance for the v2 dashboard.

--- Added requirements ('
  || to_char(now(), 'YYYY-MM-DD')
  || ') ---
Also add visual regression tests for the dashboard charts. Use Chromatic.',
  'Test plan doc + automation skeleton + Chromatic project wired into CI.',
  '[]'::jsonb,
  4,
  now() + interval '4 days',
  now() - interval '3 days',
  now() - interval '2 days',
  null,
  array[]::text[],
  0,
  jsonb_build_array(
    jsonb_build_object(
      'id', 'tl_008_a', 'at', now() - interval '2 days',
      'byUserId', 'usr_eve', 'kind', 'accepted',
      'payload', jsonb_build_object('estimatedDays', 4)
    ),
    jsonb_build_object(
      'id', 'tl_008_b', 'at', now() - interval '12 hours',
      'byUserId', 'usr_eve', 'kind', 'comment',
      'note', 'Drafted the a11y portion of the plan, looking at perf next.'
    ),
    jsonb_build_object(
      'id', 'tl_008_c', 'at', now() - interval '4 hours',
      'byUserId', 'usr_alice', 'kind', 'requirement-edit',
      'note', 'Also add visual regression tests for the dashboard charts. Use Chromatic.',
      'payload', jsonb_build_object('previousStatus', 'active')
    )
  )::jsonb
);

-- 9. Carol's ON-HOLD task (admin → Carol, no project lead).
insert into public.tasks (
  id, title, type, dev_kind, project_id, client_id,
  assignee_id, assigner_id, status, brief, expected_output,
  attachments, estimated_days, deadline, created_at, accepted_at, completed_at,
  parallel_with, sequence_index, timeline
) values (
  'tsk_009',
  'Internal tools cleanup',
  'development',
  'other',
  'prj_internal',
  'cli_initech',
  'usr_carol',
  'admin',
  'on-hold',
  'Clean up the internal admin tools. Lots of dead code from the v1 migration.',
  'Removed dead code; surviving tools have one-line docs.',
  '[]'::jsonb,
  7,
  now() + interval '7 days',
  now() - interval '6 days',
  now() - interval '5 days',
  null,
  array[]::text[],
  1,
  jsonb_build_array(
    jsonb_build_object(
      'id', 'tl_009_a', 'at', now() - interval '5 days',
      'byUserId', 'usr_carol', 'kind', 'accepted',
      'payload', jsonb_build_object('estimatedDays', 7)
    ),
    jsonb_build_object(
      'id', 'tl_009_b', 'at', now() - interval '2 days',
      'byUserId', 'usr_carol', 'kind', 'status-change',
      'note', 'Pausing — switching focus to the API project for now.',
      'payload', jsonb_build_object('from', 'active', 'to', 'on-hold')
    )
  )::jsonb
);

-- 10. Eve's COMPLETED task (admin → Eve). For verifying "Show completed" toggle.
insert into public.tasks (
  id, title, type, dev_kind, project_id, client_id,
  assignee_id, assigner_id, status, brief, expected_output,
  attachments, estimated_days, deadline, created_at, accepted_at, completed_at,
  parallel_with, sequence_index, timeline
) values (
  'tsk_010',
  'Audit existing test coverage',
  'development',
  'testing',
  null,
  null,
  'usr_eve',
  'admin',
  'completed',
  'Run a coverage audit and report gaps with prioritization.',
  'Coverage report + prioritized gap list with effort estimates.',
  '[]'::jsonb,
  2,
  now() - interval '5 days',
  now() - interval '10 days',
  now() - interval '8 days',
  now() - interval '5 days',
  array[]::text[],
  1,
  jsonb_build_array(
    jsonb_build_object(
      'id', 'tl_010_a', 'at', now() - interval '8 days',
      'byUserId', 'usr_eve', 'kind', 'accepted',
      'payload', jsonb_build_object('estimatedDays', 2)
    ),
    jsonb_build_object(
      'id', 'tl_010_b', 'at', now() - interval '6 days',
      'byUserId', 'usr_eve', 'kind', 'comment',
      'note', 'Coverage at 64%, big gaps in payments + the auth module.'
    ),
    jsonb_build_object(
      'id', 'tl_010_c', 'at', now() - interval '5 days',
      'byUserId', 'usr_eve', 'kind', 'completed'
    )
  )::jsonb
);

-- 11. Dave's pending leadership task (admin → Dave). Project Mobile App, not yet accepted.
insert into public.tasks (
  id, title, type, dev_kind, project_id, client_id,
  assignee_id, assigner_id, status, brief, expected_output,
  attachments, estimated_days, deadline, created_at, accepted_at, completed_at,
  parallel_with, sequence_index, timeline
) values (
  'tsk_011',
  'Lead Mobile App rollout',
  'leadership',
  null,
  'prj_mobile',
  'cli_acme',
  'usr_dave',
  'admin',
  'pending',
  'Lead the iOS + Android beta rollout. Coordinate with marketing on launch comms.',
  'Launch plan + dev team designated + first beta build through TestFlight / Internal Testing.',
  '[]'::jsonb,
  null,
  null,
  now() - interval '6 hours',
  null,
  null,
  array[]::text[],
  2,
  '[]'::jsonb
);

-- 12. Bob's third task (admin → Bob). Pending. Locked behind tsk_004 (active).
insert into public.tasks (
  id, title, type, dev_kind, project_id, client_id,
  assignee_id, assigner_id, status, brief, expected_output,
  attachments, estimated_days, deadline, created_at, accepted_at, completed_at,
  parallel_with, sequence_index, timeline
) values (
  'tsk_012',
  'Document the new gateway',
  'development',
  'docs',
  'prj_api',
  'cli_globex',
  'usr_bob',
  'admin',
  'pending',
  'Once the gateway is live, write developer docs covering: how to add a new endpoint, how local dev points at it, error handling.',
  'Public docs page + private runbook for the on-call team.',
  '[]'::jsonb,
  null,
  null,
  now() - interval '12 hours',
  null,
  null,
  array[]::text[],
  2,
  '[]'::jsonb
);

commit;

-- ---------- VERIFY ----------
-- Run these to sanity-check after seeding:
-- select count(*) from public.users;     -- 5
-- select count(*) from public.clients;   -- 3
-- select count(*) from public.projects;  -- 4
-- select count(*) from public.tasks;     -- 12
-- select status, count(*) from public.tasks group by status;
--   pending: 3 · active: 2 · parallel: 2 · blocked: 1 · on-hold: 1 · requirements-addition: 1 · completed: 2
