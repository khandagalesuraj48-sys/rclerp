-- =====================================================================
-- RCL Fleet ERP – step 1zf: how full the database and the files are, and the copy of the files to Google Drive (update-158)
-- Run once in Supabase → SQL Editor, in EVERY site's project (VTR NH 848, 18B KOLHAPUR, …), AFTER step 1ze. Safe to run again.
-- It only ADDS (nothing that is there is changed or removed):
--   1. web_usage() – the size of this database and of its files (how many, how big, per place); it only reads;
--   2. web_files(after, id, n) – the list of the files of the app's two places (diesel-photos, erp-files) in the order they were
--      kept (name, size, fingerprint, kind) – for the copy to Google Drive; it only reads;
--   3. one new, empty table backup_drive – what is already in Google Drive (each file once: where it is there and its MD5
--      fingerprint; the folders; the shortcuts of a shared file and of a bill), so nothing is copied twice;
--   4. one new, empty table backup_drive_state – one line: where the copy is (how far it got, how many, the files to try again).
-- Only the server (the secret key) can call the two functions or open the tables. No file and no row of the app is changed; the
-- copy only READS the files – it never changes or deletes one, here or in Drive.
-- Until it is run the app works as before; the Storage panel and the Drive copy say this file must be run first.
-- Rollback (code first: Vercel → Instant Rollback; then, only if wanted):
--   drop function public.web_usage(); drop function public.web_files(timestamptz, uuid, int);
--   (the tables backup_drive and backup_drive_state are kept – they say where every file is in Drive)
-- =====================================================================
begin;

-- 1. the size of this database and of its files
create or replace function public.web_usage()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'db', pg_catalog.pg_database_size(pg_catalog.current_database()),
    'files', coalesce((select jsonb_agg(jsonb_build_object('bucket', b, 'n', n, 'bytes', s) order by b) from (
        select bucket_id as b, count(*) as n,
               coalesce(sum(case when (metadata->>'size') ~ '^[0-9]{1,15}$' then (metadata->>'size')::bigint else 0 end), 0) as s
          from storage.objects group by bucket_id) x), '[]'::jsonb),
    'at', now());
$$;
revoke all on function public.web_usage() from public, anon, authenticated;
grant execute on function public.web_usage() to service_role;

-- 2. the files of the app, in the order they were kept (at most 500 at a time)
create or replace function public.web_files(p_after timestamptz, p_id uuid, p_n int)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'b', o.bucket_id, 'p', o.name, 'at', o.created_at,
           'size', case when (o.metadata->>'size') ~ '^[0-9]{1,15}$' then (o.metadata->>'size')::bigint else null end,
           'md5', o.metadata->>'eTag', 'mime', o.metadata->>'mimetype') order by o.created_at, o.id), '[]'::jsonb)
    from (select * from storage.objects
           where bucket_id in ('diesel-photos', 'erp-files')
             and (created_at, id) > (coalesce(p_after, '-infinity'::timestamptz), coalesce(p_id, '00000000-0000-0000-0000-000000000000'::uuid))
           order by created_at, id
           limit greatest(1, least(coalesce(p_n, 200), 500))) o;
$$;
revoke all on function public.web_files(timestamptz, uuid, int) from public, anon, authenticated;
grant execute on function public.web_files(timestamptz, uuid, int) to service_role;

-- 3. what is already in Google Drive (root = the Drive folder of the backup: another Google account starts its own copy)
create table if not exists public.backup_drive (
  root text not null,                  -- the backup's own folder in Drive ("RCL ERP – Files")
  src text not null,                   -- file:<place>/<name> · folder:<path> · link:<entry>:<place>/<name>
  kind text not null,                  -- file · folder · link
  drive_id text not null,              -- the file, folder or shortcut in Drive
  parent text,                         -- the Drive folder it is in
  name text,
  bytes bigint,
  md5 text,                            -- the file's MD5 as Drive counted it (the same as the file here – checked before it is noted)
  at timestamptz not null default now(),
  primary key (root, src)
);
alter table public.backup_drive enable row level security;
revoke all on public.backup_drive from public, anon, authenticated;
grant select, insert on public.backup_drive to service_role;
revoke update, delete, truncate on public.backup_drive from service_role;      -- a line once written stays as it is

-- 4. where the copy is (one line, changed as the copy goes on; never deleted)
create table if not exists public.backup_drive_state (
  id text primary key,                 -- 'drive'
  value text not null,                 -- how far it got, how many, the files to try again
  at timestamptz not null default now()
);
alter table public.backup_drive_state enable row level security;
revoke all on public.backup_drive_state from public, anon, authenticated;
grant select, insert, update on public.backup_drive_state to service_role;
revoke delete, truncate on public.backup_drive_state from service_role;

commit;
notify pgrst, 'reload schema';
select 'Step 1zf done · web_usage ' || (select count(*) from pg_proc where proname = 'web_usage' and pronamespace = 'public'::regnamespace)
  || ' · web_files ' || (select count(*) from pg_proc where proname = 'web_files' and pronamespace = 'public'::regnamespace)
  || ' · backup_drive ' || (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'backup_drive')
  || ' · backup_drive_state ' || (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'backup_drive_state') as done;
