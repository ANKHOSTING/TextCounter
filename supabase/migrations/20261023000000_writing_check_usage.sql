-- Anonymous per-device daily usage counter for the AI writing check. No user accounts, no text stored.
create table if not exists public.ai_usage (
  device_id text not null,
  day date not null default (now() at time zone 'utc')::date,
  count int not null default 0,
  primary key (device_id, day)
);
alter table public.ai_usage enable row level security; -- no policies: only the service role (Edge Function) can access

create or replace function public.increment_ai_usage(p_device text)
returns int language sql security definer set search_path = public as $$
  insert into ai_usage (device_id, day, count) values (p_device, (now() at time zone 'utc')::date, 1)
  on conflict (device_id, day) do update set count = ai_usage.count + 1
  returning count;
$$;
revoke all on function public.increment_ai_usage(text) from public, anon, authenticated;
