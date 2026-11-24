-- Real-time 1:1 competition. Questions and grading are written only by a
-- server-side Edge Function; the APK never receives answer keys or a service key.

alter table public.competition_rooms
  add column country_code text not null default 'EG' check (country_code in ('EG', 'JO')),
  add column study_track text not null default 'scientific' check (char_length(trim(study_track)) between 2 and 60),
  add column match_scope text not null default 'subject' check (match_scope in ('subject', 'all')),
  add column difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  add column answer_deadline_at timestamptz;

update public.competition_rooms
set match_scope = case when subject_id is null then 'all' else 'subject' end;

alter table public.competition_rooms
  add constraint competition_rooms_scope_subject_check check (
    (match_scope = 'all' and subject_id is null) or (match_scope = 'subject' and subject_id is not null)
  );

create index competition_rooms_waiting_match_idx
  on public.competition_rooms (country_code, study_track, match_scope, subject_id, difficulty, max_questions, created_at)
  where status = 'waiting';
create index competition_players_user_room_idx on public.competition_players (user_id, room_id);

create table public.competition_questions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.competition_rooms(id) on delete cascade,
  ordinal smallint not null check (ordinal between 1 and 40),
  prompt text not null check (char_length(trim(prompt)) between 1 and 4000),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  created_at timestamptz not null default now(),
  unique (room_id, ordinal)
);
create index competition_questions_room_ordinal_idx on public.competition_questions (room_id, ordinal);

create table public.competition_answers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.competition_rooms(id) on delete cascade,
  question_id uuid not null references public.competition_questions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  answer text not null check (char_length(trim(answer)) between 1 and 4000),
  submitted_at timestamptz not null default now(),
  unique (question_id, user_id)
);
create index competition_answers_room_user_idx on public.competition_answers (room_id, user_id, submitted_at);

alter table public.competition_questions enable row level security;
alter table public.competition_answers enable row level security;

drop policy if exists "rooms_creator_insert" on public.competition_rooms;
drop policy if exists "players_join_self" on public.competition_players;
drop policy if exists "competition_chat_player_send" on public.competition_messages;

create policy "competition_questions_visible_to_players" on public.competition_questions
  for select to authenticated
  using (
    exists (
      select 1 from public.competition_players player
      where player.room_id = competition_questions.room_id
        and player.user_id = (select auth.uid())
    ) or (select public.is_admin())
  );

create policy "competition_answers_visible_to_owner_or_finished_players" on public.competition_answers
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      exists (
        select 1 from public.competition_rooms room
        join public.competition_players player on player.room_id = room.id
        where room.id = competition_answers.room_id
          and room.status = 'finished'
          and player.user_id = (select auth.uid())
      )
    )
    or (select public.is_admin())
  );

create policy "competition_answers_player_submit_once" on public.competition_answers
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.competition_rooms room
      join public.competition_players player on player.room_id = room.id
      join public.competition_questions question on question.id = competition_answers.question_id and question.room_id = room.id
      where room.id = competition_answers.room_id
        and room.status = 'active'
        and (room.answer_deadline_at is null or room.answer_deadline_at > now())
        and player.user_id = (select auth.uid())
    )
  );

create policy "competition_chat_active_player_send" on public.competition_messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.competition_rooms room
      join public.competition_players player on player.room_id = room.id
      where room.id = competition_messages.room_id
        and room.status in ('active', 'finished')
        and player.user_id = (select auth.uid())
    )
  );

create or replace function public.join_competition(
  requested_scope text,
  requested_subject_id uuid,
  requested_difficulty text,
  requested_question_count smallint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_country text;
  caller_track text;
  matched_room_id uuid;
begin
  if caller_id is null then raise exception 'Authentication is required.' using errcode = '42501'; end if;
  if requested_scope is null or requested_scope not in ('subject', 'all') then raise exception 'Invalid competition scope.' using errcode = '22023'; end if;
  if requested_difficulty is null or requested_difficulty not in ('easy', 'medium', 'hard') then raise exception 'Invalid competition difficulty.' using errcode = '22023'; end if;
  if requested_question_count is null or requested_question_count not between 5 and 40 then raise exception 'Invalid question count.' using errcode = '22023'; end if;
  if (requested_scope = 'subject' and requested_subject_id is null) or (requested_scope = 'all' and requested_subject_id is not null) then
    raise exception 'The selected subject does not match the competition scope.' using errcode = '22023';
  end if;

  select profile.country_code, profile.study_track into caller_country, caller_track
  from public.profiles profile where profile.id = caller_id;
  if caller_country is null then raise exception 'Complete the student profile first.' using errcode = 'P0001'; end if;

  if requested_subject_id is not null and not exists (
    select 1 from public.subjects subject
    where subject.id = requested_subject_id
      and subject.active
      and subject.country_code = caller_country
      and subject.study_track = caller_track
  ) then raise exception 'The selected subject is unavailable for this student.' using errcode = '22023'; end if;

  -- Serialize only an identical queue key; this prevents two students joining
  -- the same waiting room at the same time without locking unrelated queues.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    caller_country || ':' || caller_track || ':' || requested_scope || ':' || coalesce(requested_subject_id::text, '-') || ':' || requested_difficulty || ':' || requested_question_count::text,
    0
  ));

  select player.room_id into matched_room_id
  from public.competition_players player
  join public.competition_rooms room on room.id = player.room_id
  where player.user_id = caller_id
    and room.status = 'waiting'
    and room.country_code = caller_country
    and room.study_track = caller_track
    and room.match_scope = requested_scope
    and room.subject_id is not distinct from requested_subject_id
    and room.difficulty = requested_difficulty
    and room.max_questions = requested_question_count
  order by room.created_at desc
  limit 1;
  if matched_room_id is not null then return matched_room_id; end if;

  select room.id into matched_room_id
  from public.competition_rooms room
  where room.status = 'waiting'
    and room.country_code = caller_country
    and room.study_track = caller_track
    and room.match_scope = requested_scope
    and room.subject_id is not distinct from requested_subject_id
    and room.difficulty = requested_difficulty
    and room.max_questions = requested_question_count
    and room.creator_id <> caller_id
  order by room.created_at
  limit 1
  for update skip locked;

  if matched_room_id is null then
    insert into public.competition_rooms (creator_id, subject_id, country_code, study_track, match_scope, difficulty, max_questions)
    values (caller_id, requested_subject_id, caller_country, caller_track, requested_scope, requested_difficulty, requested_question_count)
    returning id into matched_room_id;
    insert into public.competition_players (room_id, user_id) values (matched_room_id, caller_id);
  else
    insert into public.competition_players (room_id, user_id) values (matched_room_id, caller_id)
    on conflict (room_id, user_id) do nothing;
    update public.competition_rooms
      set status = 'active', started_at = now()
      where id = matched_room_id and status = 'waiting';
  end if;

  return matched_room_id;
end;
$$;

revoke all on function public.join_competition(text, uuid, text, smallint) from public;
grant execute on function public.join_competition(text, uuid, text, smallint) to authenticated;

alter publication supabase_realtime add table public.competition_rooms, public.competition_players, public.competition_messages, public.competition_questions, public.competition_answers;
