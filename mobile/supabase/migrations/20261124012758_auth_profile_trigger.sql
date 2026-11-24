-- A profile is created only by this trusted trigger.  The mobile client passes
-- onboarding details as Auth metadata; it never receives a database service key.
drop policy if exists "profiles_insert_own" on public.profiles;

create or replace function private.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  supplied_name text := nullif(pg_catalog.btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
  supplied_country text := pg_catalog.upper(coalesce(new.raw_user_meta_data ->> 'country_code', 'EG'));
  supplied_track text := nullif(pg_catalog.btrim(coalesce(new.raw_user_meta_data ->> 'study_track', 'scientific')), '');
  supplied_phone text := nullif(pg_catalog.btrim(coalesce(new.raw_user_meta_data ->> 'phone_e164', '')), '');
  supplied_locale text := coalesce(new.raw_user_meta_data ->> 'preferred_locale', 'ar');
begin
  if supplied_name is null or pg_catalog.char_length(supplied_name) not between 2 and 80 then
    supplied_name := 'طالب رفيق';
  end if;

  if supplied_country not in ('EG', 'JO') then
    supplied_country := 'EG';
  end if;

  if supplied_track is null or pg_catalog.char_length(supplied_track) not between 2 and 60 then
    supplied_track := 'scientific';
  end if;

  if supplied_phone is not null and supplied_phone !~ '^\\+[1-9][0-9]{7,14}$' then
    supplied_phone := null;
  end if;

  if supplied_locale not in ('ar', 'en') then
    supplied_locale := 'ar';
  end if;

  insert into public.profiles (id, display_name, country_code, study_track, phone_e164, preferred_locale)
  values (new.id, supplied_name, supplied_country, supplied_track, supplied_phone, supplied_locale)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function private.create_profile_for_new_user() from public;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute procedure private.create_profile_for_new_user();
