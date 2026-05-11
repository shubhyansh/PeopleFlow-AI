-- ======================================================================
-- FlowDesk — wipe all application data (keep schema)
-- ======================================================================
--
-- Use this to reset your Supabase project back to a fresh state without
-- losing the schema or the attachments bucket configuration.
--
-- What this script does:
--   * Truncates every FlowDesk table (users, clients, projects, tasks).
--   * Leaves the schema, RLS settings, and the attachments bucket intact.
--
-- What this script does NOT do (because Supabase blocks SQL-level deletes
-- from storage.objects to prevent orphaned files):
--   * Delete uploaded attachment files.
--     → If you want those gone, open Supabase dashboard → Storage →
--       flowdesk-attachments → check the box at the top of the file list
--       → Delete. Takes ~10 seconds.
--
-- After running:
--   - Reopen FlowDesk → admin / Admin@123 still works.
--   - No employees, no projects, no clients, no tasks.
--   - Attachment files may still be in Storage (clean via Dashboard if you care).
--   - You can start onboarding teammates immediately.
--
-- How to run:
--   1. Open https://supabase.com/dashboard → your project → SQL Editor.
--   2. Click "New query".
--   3. Paste this entire file.
--   4. Click "Run".
--
-- ⚠️ This is destructive — every row is gone permanently. Make sure you
--    actually want this on the project you're connected to.
-- ======================================================================

begin;

-- Empty all FlowDesk tables. CASCADE handles any FK references.
truncate table public.tasks    restart identity cascade;
truncate table public.projects restart identity cascade;
truncate table public.clients  restart identity cascade;
truncate table public.users    restart identity cascade;

commit;

-- Sanity check — all four counts should be 0.
select
  'flowdesk wiped' as status,
  (select count(*) from public.users)    as users_rows,
  (select count(*) from public.clients)  as clients_rows,
  (select count(*) from public.projects) as projects_rows,
  (select count(*) from public.tasks)    as tasks_rows;
