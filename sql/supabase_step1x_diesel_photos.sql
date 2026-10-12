-- =====================================================================
-- RCL Fleet ERP – step 1x: the 4 photos of a diesel issue (update-85)
-- Run once in Supabase → SQL Editor (safe to run again). It only ADDS:
--   1. one empty column "photos" to diesel_issue (the list of the entry's photos: which photo, where it is kept,
--      the time and the place it was taken);
--   2. one PRIVATE place for the pictures (Storage bucket "diesel-photos"): only JPG, at most 2 MB a picture.
--      Private = a picture opens only through the app, with a link that works for 15 minutes.
-- No existing column, row or rule is changed. Until it is run the app works as before; taking a photo says
-- that this file must be run first.
-- Rollback (only while no entry has photos): alter table public.diesel_issue drop column photos;
--   and in Supabase → Storage delete the bucket diesel-photos (it must be empty).
-- =====================================================================
alter table public.diesel_issue add column if not exists photos text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('diesel-photos', 'diesel-photos', false, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

notify pgrst, 'reload schema';
