-- FlowDesk initial schema
-- Paste this entire file into your Supabase project's SQL editor and click "Run".
-- (Dashboard → SQL Editor → New query)

-- ---------- users ----------
create table if not exists public.users (
  id              text primary key,
  username        text unique not null,
  password_hash   text not null,
  name            text not null,
  role            text not null check (role in ('admin', 'employee', 'lead')),
  designation     text not null default '',
  description     text not null default '',
  created_at      timestamptz not null default now()
);

create index if not exists users_username_idx on public.users (lower(username));

-- ---------- clients ----------
create table if not exists public.clients (
  id          text primary key,
  name        text unique not null,
  created_at  timestamptz not null default now()
);

-- ---------- projects ----------
create table if not exists public.projects (
  id          text primary key,
  name        text not null,
  client_id   text references public.clients(id) on delete set null,
  lead_id     text references public.users(id)   on delete set null,
  member_ids  text[] not null default '{}'::text[],
  created_at  timestamptz not null default now()
);

create index if not exists projects_client_idx on public.projects (client_id);
create index if not exists projects_lead_idx   on public.projects (lead_id);

-- ---------- tasks ----------
create table if not exists public.tasks (
  id              text primary key,
  title           text not null,
  type            text not null check (type in ('leadership', 'development')),
  dev_kind        text,
  project_id      text references public.projects(id) on delete set null,
  client_id       text references public.clients(id)  on delete set null,
  assignee_id     text not null references public.users(id) on delete cascade,
  assigner_id     text not null references public.users(id) on delete restrict,
  status          text not null default 'pending'
                    check (status in ('pending','active','parallel','blocked',
                                      'requirements-addition','on-hold','completed')),
  brief           text not null default '',
  expected_output text not null default '',
  attachments     jsonb not null default '[]'::jsonb,
  estimated_days  integer,
  deadline        timestamptz,
  created_at      timestamptz not null default now(),
  accepted_at     timestamptz,
  completed_at    timestamptz,
  parallel_with   text[] not null default '{}'::text[],
  sequence_index  integer not null default 0,
  timeline        jsonb not null default '[]'::jsonb
);

create index if not exists tasks_assignee_idx on public.tasks (assignee_id);
create index if not exists tasks_project_idx  on public.tasks (project_id);
create index if not exists tasks_status_idx   on public.tasks (status);

-- ---------- access control ----------
-- Phase 1: RLS is disabled. The anon key has full read/write because passwords
-- are bcrypt-hashed at the app layer and the app is shipped to a trusted team.
-- A later phase replaces this with proper RLS once the auth model is finalized.

alter table public.users    disable row level security;
alter table public.clients  disable row level security;
alter table public.projects disable row level security;
alter table public.tasks    disable row level security;

-- Verify with:  select 'flowdesk schema ready' as status;
