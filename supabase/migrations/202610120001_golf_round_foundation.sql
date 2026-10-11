-- Extensible course registry and normalized, device-independent round history.
-- Apply after the existing rounds / round_holes / profiles tables are present.

alter table public.profiles
  add column if not exists handicap_index numeric(4,1),
  add column if not exists skill_group text not null default 'beginner',
  add column if not exists skill_group_source text not null default 'self_reported';

alter table public.profiles
  drop constraint if exists profiles_handicap_index_range;
alter table public.profiles
  add constraint profiles_handicap_index_range
  check (handicap_index is null or handicap_index between -10 and 54);

alter table public.profiles
  drop constraint if exists profiles_skill_group_allowed;
alter table public.profiles
  add constraint profiles_skill_group_allowed
  check (skill_group in ('beginner', 'amateur', 'pro'));

create or replace function public.sync_golf_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_handicap numeric;
begin
  if coalesce(new.raw_user_meta_data ->> 'handicap_index', '') ~ '^-?[0-9]+(\.[0-9]+)?$' then
    v_handicap := (new.raw_user_meta_data ->> 'handicap_index')::numeric;
    if v_handicap < -10 or v_handicap > 54 then v_handicap := null; end if;
  end if;
  insert into public.profiles (id, nickname, handicap_index, skill_group, skill_group_source)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nickname'), ''), '골퍼'),
    v_handicap,
    case when v_handicap is null or v_handicap > 36 then 'beginner'
      when v_handicap > 0 then 'amateur' else 'pro' end,
    'self_reported'
  )
  on conflict (id) do update set
    nickname = excluded.nickname,
    handicap_index = excluded.handicap_index,
    skill_group = excluded.skill_group,
    skill_group_source = excluded.skill_group_source;
  return new;
end;
$$;

drop trigger if exists sync_golf_profile_from_auth_user on auth.users;
create trigger sync_golf_profile_from_auth_user
  after insert on auth.users
  for each row execute function public.sync_golf_profile_from_auth_user();

create table if not exists public.golf_courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  region text,
  address text,
  venue_kind text not null check (venue_kind in ('physical', 'virtual_screen')),
  supports_field boolean not null default false,
  supports_screen boolean not null default false,
  hole_count smallint,
  source_name text not null,
  source_record_id text,
  source_license text,
  source_updated_at timestamptz,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected')),
  aliases text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (supports_field or supports_screen),
  check (venue_kind <> 'virtual_screen' or (supports_screen and not supports_field))
);

create unique index if not exists golf_courses_normalized_name_region_uidx
  on public.golf_courses (normalized_name, coalesce(region, ''));
create index if not exists golf_courses_name_search_idx
  on public.golf_courses using gin (to_tsvector('simple', name));

create table if not exists public.golf_course_routes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.golf_courses(id) on delete cascade,
  route_code text not null,
  display_name text not null,
  hole_count smallint not null default 9 check (hole_count in (9, 18)),
  pars smallint[] not null default '{}',
  distances_m smallint[] not null default '{}',
  source_name text not null default 'admin_curated',
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, route_code),
  check (cardinality(pars) = 0 or cardinality(pars) = hole_count),
  check (cardinality(distances_m) = 0 or cardinality(distances_m) = hole_count)
);

alter table public.rounds
  add column if not exists course_id uuid references public.golf_courses(id) on delete set null,
  add column if not exists play_mode text check (play_mode in ('field', 'screen')),
  add column if not exists route_ids uuid[] not null default '{}',
  add column if not exists started_at timestamptz,
  add column if not exists skill_group_at_round text,
  add column if not exists visibility text not null default 'private'
    check (visibility in ('private', 'friends', 'aggregate'));

create table if not exists public.round_shots (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  hole_number smallint not null check (hole_number between 1 and 18),
  shot_number smallint not null check (shot_number between 1 and 30),
  club text not null,
  distance_to_pin_before integer not null check (distance_to_pin_before between 0 and 800),
  distance_to_pin_after integer not null check (distance_to_pin_after between 0 and 800),
  shot_distance integer not null check (shot_distance between 0 and 800),
  ball_lie text not null,
  penalty smallint not null default 0 check (penalty between 0 and 5),
  recorded_at timestamptz not null default now(),
  unique (round_id, hole_number, shot_number)
);
create index if not exists round_shots_round_hole_idx
  on public.round_shots (round_id, hole_number, shot_number);

alter table public.golf_courses enable row level security;
alter table public.golf_course_routes enable row level security;
alter table public.round_shots enable row level security;

drop policy if exists "verified courses are readable" on public.golf_courses;
create policy "verified courses are readable" on public.golf_courses
  for select using (verification_status = 'verified');
drop policy if exists "verified routes are readable" on public.golf_course_routes;
create policy "verified routes are readable" on public.golf_course_routes
  for select using (
    verification_status = 'verified' and exists (
      select 1 from public.golf_courses c
      where c.id = course_id and c.verification_status = 'verified'
    )
  );
drop policy if exists "round owners manage their shots" on public.round_shots;
create policy "round owners manage their shots" on public.round_shots
  for all using (exists (
    select 1 from public.rounds r where r.id = round_id and r.user_id = auth.uid()
  )) with check (exists (
    select 1 from public.rounds r where r.id = round_id and r.user_id = auth.uid()
  ));

comment on table public.golf_courses is
  'Stable golf venue identity. MCST public data and administrator corrections only; third-party feeds require an authorized adapter.';
comment on table public.golf_course_routes is
  'Verified playable route segments (e.g. OUT, IN). Route pair and order are captured on each round.';
comment on table public.round_shots is
  'Normalized per-shot records synchronized across devices. round_holes.shots remains a compatibility snapshot.';
