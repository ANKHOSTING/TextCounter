-- Daily cleanup of per-device usage counts (kept ~2 days, then deleted). Same guard as the ai_rate_limit cleanup:
-- uses pg_cron when available; otherwise run the delete manually or from any scheduler (see docs/SETUP.md).
-- Failure to schedule never fails the migration.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('ai-usage-cleanup', '23 3 * * *',
    $job$delete from public.ai_usage where day < (now() at time zone 'utc')::date - 1$job$);
exception when others then
  raise notice 'pg_cron not available (%); schedule: delete from public.ai_usage where day < (now() at time zone ''utc'')::date - 1;', sqlerrm;
end $$;
