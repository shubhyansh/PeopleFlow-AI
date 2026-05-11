-- FlowDesk migration #4
-- Run AFTER 0003_drop_assigner_fk.sql in the Supabase SQL editor.
--
-- Creates the storage bucket and policies for task attachments. Files
-- uploaded by the admin during task creation land in this bucket; their
-- public URLs are stored in tasks.attachments JSONB.
--
-- The bucket is PUBLIC (read), and the anon key may upload. This matches the
-- trusted-team / shipped-binary model. Tighten with proper RLS later if you
-- expose FlowDesk beyond a private team.

-- 1. Create the bucket if it doesn't already exist.
insert into storage.buckets (id, name, public)
values ('flowdesk-attachments', 'flowdesk-attachments', true)
on conflict (id) do nothing;

-- 2. Policies: anyone can read; anyone can upload; allow updates/deletes too.
-- Drop old versions first so this migration is idempotent.
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

-- Verify with: select id, name, public from storage.buckets where id = 'flowdesk-attachments';
