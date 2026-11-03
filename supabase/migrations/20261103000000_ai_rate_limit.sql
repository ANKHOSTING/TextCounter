-- Per-IP and global daily request caps for the writing-check Edge Function.
-- Keys are SHA-256 hashes of the caller IP (never the raw IP); rows are pruned after 2 days. No text is stored.
create table if not exists public.ai_rate_limit (
  key text not null,
  day date not null default (now() at time zone 'utc')::date,
  count int not null default 0,
  primary key (key, day)
);
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
  delete from ai_rate_limit where day < d - 1;
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
