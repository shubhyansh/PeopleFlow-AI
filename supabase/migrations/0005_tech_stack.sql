-- FlowDesk migration #5
-- Run AFTER 0004_attachments_bucket.sql in the Supabase SQL editor.
--
-- Adds a `tech_stack` column to tasks so the requirements pipeline can capture
-- which languages / frameworks / infra a task involves. Rendered as pills in
-- the task drawer.
--
-- Also tells Supabase's PostgREST to reload its schema cache so the new column
-- is visible immediately (otherwise you'll see PGRST204 errors until the cache
-- refreshes on its own).

alter table public.tasks
  add column if not exists tech_stack text[] not null default '{}'::text[];

notify pgrst, 'reload schema';

-- Verify with: select id, title, tech_stack from public.tasks limit 5;
