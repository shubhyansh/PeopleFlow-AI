-- ======================================================================
-- FlowDesk — one-shot bootstrap SQL
-- ======================================================================
--
-- Run this ONCE in your Supabase project to set up everything FlowDesk
-- needs: tables, indexes, the attachments storage bucket, and PostgREST
-- schema reload.
--
-- How to run:
--   1. Open https://supabase.com/dashboard → your project → SQL Editor.
--   2. Click "New query".
--   3. Paste this entire file.
--   4. Click "Run" (Ctrl/Cmd + Enter).
--   5. You should see "Success. No rows returned."
--
-- Safe to re-run: every statement uses `if not exists` / `on conflict do
-- nothing` / `drop ... if exists`, so this is idempotent.
-- ======================================================================


-- ---------- users ----------
create table if not exists public.users (
  id              text primary key,
  username        text unique not null,
  password_hash   text,                                -- nullable: employee sets on first login
  name            text not null,
  role            text not null,
  designation     text not null default '',
  description     text not null default '',
  created_at      timestamptz not null default now()
);

alter table public.users drop constraint if exists users_role_check;
alter table public.users
  add constraint users_role_check check (role in ('admin', 'employee'));

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
  -- NOTE: assigner_id has NO foreign key because 'admin' is a hardcoded
  -- account that lives outside the users table.
  assigner_id     text not null,
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
  timeline        jsonb not null default '[]'::jsonb,
  tech_stack      text[] not null default '{}'::text[]
);

create index if not exists tasks_assignee_idx on public.tasks (assignee_id);
create index if not exists tasks_project_idx  on public.tasks (project_id);
create index if not exists tasks_status_idx   on public.tasks (status);


-- ---------- row level security ----------
-- The app uses bcrypt-hashed app-level auth, not Supabase Auth. We keep RLS
-- disabled so the anon key (shipped with the desktop binary) can read/write.
-- If you ever expose FlowDesk to untrusted users, tighten this with proper
-- RLS policies tied to a real Supabase Auth role first.
alter table public.users    disable row level security;
alter table public.clients  disable row level security;
alter table public.projects disable row level security;
alter table public.tasks    disable row level security;


-- ---------- attachments storage bucket ----------
insert into storage.buckets (id, name, public)
values ('flowdesk-attachments', 'flowdesk-attachments', true)
on conflict (id) do nothing;

drop policy if exists "flowdesk attachments: read"   on storage.objects;
drop policy if exists "flowdesk attachments: write"  on storage.objects;
drop policy if exists "flowdesk attachments: update" on storage.objects;
drop policy if exists "flowdesk attachments: delete" on storage.objects;

create policy "flowdesk attachments: read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'flowdesk-attachments');

create policy "flowdesk attachments: write"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'flowdesk-attachments');

create policy "flowdesk attachments: update"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'flowdesk-attachments')
  with check (bucket_id = 'flowdesk-attachments');

create policy "flowdesk attachments: delete"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'flowdesk-attachments');


-- ---------- tell PostgREST to reload its schema cache ----------
-- Without this, freshly added columns can return PGRST204 for a few minutes.
notify pgrst, 'reload schema';


-- Done. Quick sanity check:
select
  'flowdesk schema ready' as status,
  (select count(*) from public.users)    as users_rows,
  (select count(*) from public.clients)  as clients_rows,
  (select count(*) from public.projects) as projects_rows,
  (select count(*) from public.tasks)    as tasks_rows;
