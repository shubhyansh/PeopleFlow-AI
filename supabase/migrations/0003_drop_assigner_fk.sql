-- FlowDesk migration #3
-- Run AFTER 0002_password_optional_and_role.sql in the Supabase SQL editor.
--
-- The hardcoded "admin" user lives OUTSIDE the users table (per spec — admin is
-- a single fixed account, not a row). With the original FK constraint on
-- tasks.assigner_id, every admin-assigned task fails the foreign key check.
-- Drop the FK so assigner_id can be 'admin' or any user id.
--
-- (assignee_id keeps its FK because tasks are always assigned to real users in
-- the users table.)

alter table public.tasks
  drop constraint if exists tasks_assigner_id_fkey;

-- Verify with: select id, title, assigner_id from public.tasks limit 10;
