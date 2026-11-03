-- Per-IP and global daily request caps for the writing-check Edge Function.
-- Keys are HMAC-SHA256 hashes of the caller IP keyed with IP_HASH_SECRET (never the raw IP); old rows are pruned by a daily schedule (below),
-- not per call. No text is stored.
create table if not exists public.ai_rate_limit (
  key text not null,
  day date not null default (now() at time zone 'utc')::date,
  count int not null default 0,
  primary key (key, day)
);
create index if not exists ai_rate_limit_day_idx on public.ai_rate_limit (day);
alter table public.ai_rate_limit enable row level security; -- no policies: service role only

-- Atomically counts one request. Returns 'ok' | 'ip_limit' | 'global_limit'.
-- The global counter only increments for requests that passed the per-IP cap.
create or replace function public.consume_ai_quota(p_ip_key text, p_ip_limit int, p_global_limit int)
returns text language plpgsql security definer set search_path = public as $$
declare
  d date := (now() at time zone 'utc')::date;
  ip_count int;
  global_count int;
begin
  insert into ai_rate_limit (key, day, count) values ('ip:' || p_ip_key, d, 1)
    on conflict (key, day) do update set count = ai_rate_limit.count + 1
    returning count into ip_count;
  if ip_count > p_ip_limit then return 'ip_limit'; end if;
  insert into ai_rate_limit (key, day, count) values ('global', d, 1)
    on conflict (key, day) do update set count = ai_rate_limit.count + 1
    returning count into global_count;
  if global_count > p_global_limit then return 'global_limit'; end if;
  return 'ok';
end $$;
revoke all on function public.consume_ai_quota(text, int, int) from public, anon, authenticated;

-- Gives back one unit of the per-device free quota (used when the AI call fails after the atomic reserve).
create or replace function public.refund_ai_usage(p_device text)
returns void language sql security definer set search_path = public as $$
  update ai_usage set count = greatest(count - 1, 0) where device_id = p_device and day = (now() at time zone 'utc')::date;
$$;
revoke all on function public.refund_ai_usage(text) from public, anon, authenticated;

-- Gives back one IP + one global unit (used when the AI call fails after quota was consumed with result 'ok').
create or replace function public.refund_ai_quota(p_ip_key text)
returns void language sql security definer set search_path = public as $$
  update ai_rate_limit set count = greatest(count - 1, 0)
    where day = (now() at time zone 'utc')::date and key in ('ip:' || p_ip_key, 'global');
$$;
revoke all on function public.refund_ai_quota(text) from public, anon, authenticated;

-- Daily cleanup (replaces the per-call delete). Uses pg_cron when available; otherwise run the delete manually
-- or from any scheduler (see docs/SETUP.md). Failure to schedule never fails the migration.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('ai-rate-limit-cleanup', '17 3 * * *',
    $job$delete from public.ai_rate_limit where day < (now() at time zone 'utc')::date - 1$job$);
exception when others then
  raise notice 'pg_cron not available (%); schedule: delete from public.ai_rate_limit where day < current_date - 1;', sqlerrm;
end $$;
