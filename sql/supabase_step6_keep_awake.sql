-- =====================================================================
-- RCL Fleet ERP – step 6: KEEP THE SERVER AWAKE (update-86)
-- The hosting (Vercel) puts the app's server to sleep when nobody has used it for some minutes; the next person then waits
-- seconds while it wakes. From here the DATABASE calls the app's "wake" address every 3 minutes, so it never sleeps.
-- Run once in Supabase → SQL Editor (safe to run again). It only ADDS a timetable entry (pg_cron) that makes one small web
-- call (pg_net) – the address answers only "ok", no data goes anywhere. No table, column or row of the app is touched.
-- Uses the Supabase extensions pg_cron and pg_net (switched on here if they are not on yet).
-- ANOTHER COPY OF THE APP (another site): put ITS address in the line with https:// below before running it there.
-- Rollback: select cron.unschedule('oneclick-keep-awake'); select cron.unschedule('oneclick-keep-awake-log');
-- =====================================================================
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- (run again: the old timetable entries are taken away first, then made again)
select cron.unschedule(jobid) from cron.job where jobname in ('oneclick-keep-awake', 'oneclick-keep-awake-log');

-- every 3 minutes: call the app's wake address
select cron.schedule('oneclick-keep-awake', '*/3 * * * *',
  $$ select net.http_get(url := 'https://oneclicksolution-erp.vercel.app/api/rpc?warm=1', timeout_milliseconds := 30000) $$);

-- once a day: the timetable's own run log older than 3 days is cleared (it would grow by ~480 lines a day; app data untouched)
select cron.schedule('oneclick-keep-awake-log', '15 3 * * *',
  $$ delete from cron.job_run_details where end_time < now() - interval '3 days' $$);
