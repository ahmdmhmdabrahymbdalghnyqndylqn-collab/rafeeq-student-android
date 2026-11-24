create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;

create type public.app_role as enum ('student', 'admin');
create type public.plan_task_status as enum ('planned', 'completed', 'skipped');
create type public.competition_status as enum ('waiting', 'active', 'finished', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 2 and 80),
  country_code text not null check (country_code in ('EG', 'JO')),
  study_track text not null check (char_length(study_track) between 2 and 60),
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  preferred_locale text not null default 'ar' check (preferred_locale in ('ar', 'en')),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id),
  note text
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.admin_users where user_id = (select auth.uid())) $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker as $$ begin new.updated_at = now(); return new; end $$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  country_code text not null check (country_code in ('EG', 'JO')),
  study_track text not null,
  code text not null,
  name_ar text not null,
  name_en text not null,
  active boolean not null default true,
  unique (country_code, study_track, code)
);

create table public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger study_plans_updated_at before update on public.study_plans for each row execute function public.set_updated_at();

create table public.study_tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.study_plans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 160),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  status public.plan_task_status not null default 'planned',
  reminder_minutes smallint not null default 10 check (reminder_minutes between 0 and 1440),
  created_at timestamptz not null default now()
);
create index study_tasks_user_starts_idx on public.study_tasks(user_id, starts_at);

create table public.library_books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject_id uuid references public.subjects(id) on delete set null,
  cover_url text not null check (cover_url ~ '^https://'),
  read_url text not null check (read_url ~ '^https://'),
  download_url text not null check (download_url ~ '^https://'),
  language_code text not null default 'ar' check (language_code in ('ar','en')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index library_books_subject_idx on public.library_books(subject_id) where active;

create table public.library_events (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  book_id uuid not null references public.library_books(id) on delete cascade,
  event_type text not null check (event_type in ('read','download')),
  created_at timestamptz not null default now()
);
create index library_events_book_created_idx on public.library_events(book_id, created_at desc);

create table public.teacher_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger teacher_threads_updated_at before update on public.teacher_threads for each row execute function public.set_updated_at();

create table public.teacher_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.teacher_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('student','assistant')),
  content text not null check (char_length(content) between 1 and 12000),
  created_at timestamptz not null default now()
);
create index teacher_messages_thread_created_idx on public.teacher_messages(thread_id, created_at);

create table public.competition_rooms (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  status public.competition_status not null default 'waiting',
  max_questions smallint not null check (max_questions between 5 and 40),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.competition_players (
  room_id uuid not null references public.competition_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  score integer not null default 0 check (score >= 0),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create table public.competition_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.competition_rooms(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index competition_messages_room_created_idx on public.competition_messages(room_id, created_at);

create table private.exam_answer_keys (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.competition_rooms(id) on delete cascade,
  question_hash text not null,
  answer_hash text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.admin_users enable row level security;
alter table public.subjects enable row level security;
alter table public.study_plans enable row level security;
alter table public.study_tasks enable row level security;
alter table public.library_books enable row level security;
alter table public.library_events enable row level security;
alter table public.teacher_threads enable row level security;
alter table public.teacher_messages enable row level security;
alter table public.competition_rooms enable row level security;
alter table public.competition_players enable row level security;
alter table public.competition_messages enable row level security;
alter table private.exam_answer_keys enable row level security;

create policy "profiles_select_own_or_admin" on public.profiles for select to authenticated using (id = (select auth.uid()) or (select public.is_admin()));
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "subjects_read_active" on public.subjects for select to authenticated using (active or (select public.is_admin()));
create policy "subjects_admin_write" on public.subjects for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "plans_owner" on public.study_plans for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "tasks_owner" on public.study_tasks for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "books_read_active" on public.library_books for select to authenticated using (active or (select public.is_admin()));
create policy "books_admin_write" on public.library_books for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "library_events_create_own" on public.library_events for insert to authenticated with check (user_id = (select auth.uid()));
create policy "library_events_read_own_or_admin" on public.library_events for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "threads_owner" on public.teacher_threads for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "messages_owner" on public.teacher_messages for select to authenticated using (user_id = (select auth.uid()));
create policy "messages_student_insert" on public.teacher_messages for insert to authenticated with check (user_id = (select auth.uid()) and role = 'student');
create policy "rooms_visible_to_player" on public.competition_rooms for select to authenticated using (creator_id = (select auth.uid()) or exists (select 1 from public.competition_players p where p.room_id = id and p.user_id = (select auth.uid())) or (select public.is_admin()));
create policy "rooms_creator_insert" on public.competition_rooms for insert to authenticated with check (creator_id = (select auth.uid()));
create policy "players_visible_to_player" on public.competition_players for select to authenticated using (exists (select 1 from public.competition_players mine where mine.room_id = room_id and mine.user_id = (select auth.uid())) or (select public.is_admin()));
create policy "players_join_self" on public.competition_players for insert to authenticated with check (user_id = (select auth.uid()));
create policy "competition_chat_player_read" on public.competition_messages for select to authenticated using (exists (select 1 from public.competition_players p where p.room_id = competition_messages.room_id and p.user_id = (select auth.uid())));
create policy "competition_chat_player_send" on public.competition_messages for insert to authenticated with check (sender_id = (select auth.uid()) and exists (select 1 from public.competition_players p where p.room_id = competition_messages.room_id and p.user_id = (select auth.uid())));

revoke all on private.exam_answer_keys from anon, authenticated;
