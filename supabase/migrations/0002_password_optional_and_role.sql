-- FlowDesk migration #2
-- Run AFTER 0001_init.sql in the Supabase SQL editor.
--
-- Changes:
--  1. password_hash becomes nullable. Admin creates employees without a password;
--     the employee sets it themselves on first login.
--  2. Drop the role check constraint and stop using the `role` column for
--     anything other than 'employee'. Lead-ness is decided per-project at
--     assignment time (lead_id on projects table) and per-task in later phases.

alter table public.users
  alter column password_hash drop not null;

-- Loosen the role check so existing rows are not invalidated.
-- We keep the column for backward compatibility but only ever insert 'employee'.
alter table public.users
  drop constraint if exists users_role_check;

alter table public.users
  add constraint users_role_check
    check (role in ('admin', 'employee'));

-- Verify with: select id, username, password_hash is null as needs_setup, role from public.users;
