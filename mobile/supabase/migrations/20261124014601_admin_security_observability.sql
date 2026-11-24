-- Security observations are written only by trusted server-side code (for
-- example an Edge Function).  The APK can read them only after is_admin().
create table public.security_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type ~ '^[a-z][a-z0-9_.-]{2,80}$'),
  severity smallint not null default 1 check (severity between 1 and 4),
  user_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  status text not null default 'open' check (status in ('open', 'reviewed', 'resolved')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'open' and reviewed_at is null) or (status in ('reviewed', 'resolved') and reviewed_at is not null))
);

create index security_events_open_created_idx
  on public.security_events (severity desc, created_at desc)
  where status = 'open';
create index security_events_user_created_idx
  on public.security_events (user_id, created_at desc)
  where user_id is not null;

alter table public.security_events enable row level security;

create policy "security_events_admin_read" on public.security_events
  for select to authenticated
  using ((select public.is_admin()));
create policy "security_events_admin_update" on public.security_events
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "competition_chat_admin_read" on public.competition_messages
  for select to authenticated
  using ((select public.is_admin()));
create policy "competition_rooms_admin_manage" on public.competition_rooms
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create or replace function public.admin_dashboard_metrics()
returns table (
  total_students bigint,
  new_students_last_24h bigint,
  waiting_competitions bigint,
  active_competitions bigint,
  library_events_last_24h bigint,
  open_security_events bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  return query
  select
    (select count(*) from public.profiles),
    (select count(*) from public.profiles where created_at >= pg_catalog.now() - interval '24 hours'),
    (select count(*) from public.competition_rooms where status = 'waiting'),
    (select count(*) from public.competition_rooms where status = 'active'),
    (select count(*) from public.library_events where created_at >= pg_catalog.now() - interval '24 hours'),
    (select count(*) from public.security_events where status = 'open');
end;
$$;

revoke all on function public.admin_dashboard_metrics() from public;
grant execute on function public.admin_dashboard_metrics() to authenticated;

-- Realtime delivery is still guarded by each table's RLS policy.  The admin
-- APK uses this only to refresh live counters and open security observations.
alter publication supabase_realtime add table public.profiles, public.library_events, public.security_events;
