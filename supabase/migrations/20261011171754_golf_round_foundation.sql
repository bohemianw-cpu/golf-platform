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

create or replace function public.update_my_golf_level(p_handicap_index numeric)
returns table (handicap_index numeric, skill_group text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_handicap_index is not null and (p_handicap_index < -10 or p_handicap_index > 54) then
    raise exception 'Handicap index must be between -10 and 54';
  end if;
  return query
    update public.profiles p
    set handicap_index = p_handicap_index,
      skill_group = case when p_handicap_index is null or p_handicap_index > 36 then 'beginner'
        when p_handicap_index > 0 then 'amateur' else 'pro' end,
      skill_group_source = 'self_reported'
    where p.id = (select auth.uid())
    returning p.handicap_index, p.skill_group;
end;
$$;
revoke all on function public.update_my_golf_level(numeric) from public;
grant execute on function public.update_my_golf_level(numeric) to authenticated;

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
create unique index if not exists golf_courses_source_record_uidx
  on public.golf_courses (source_name, source_record_id)
  where source_record_id is not null;
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
alter table public.rounds
  drop constraint if exists rounds_skill_group_at_round_allowed;
alter table public.rounds
  add constraint rounds_skill_group_at_round_allowed
  check (skill_group_at_round is null or skill_group_at_round in ('beginner', 'amateur', 'pro'));

drop function if exists public.get_course_round_aggregate(uuid, text, text);
create or replace function public.get_course_round_aggregate(
  p_course_id uuid,
  p_play_mode text,
  p_skill_group text,
  p_route_ids uuid[] default null
)
returns table (
  sample_size bigint,
  average_score numeric,
  average_putts numeric,
  fairway_hit_percent numeric,
  gir_percent numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with per_round as (
    select
      r.id,
      r.user_id,
      r.total_score,
      sum(h.putts)::numeric as total_putts,
      count(*) filter (where h.fairway_hit is not null) as fairway_opportunities,
      count(*) filter (where h.fairway_hit = true) as fairway_hits,
      count(*) as holes_played,
      count(*) filter (where h.gir = true) as greens_hit
    from public.rounds r
    join public.round_holes h on h.round_id = r.id
    where r.status = 'completed'
      and r.visibility = 'aggregate'
      and (p_course_id is null or r.course_id = p_course_id)
      and (p_play_mode is null or r.play_mode = p_play_mode)
      and (p_route_ids is null or r.route_ids = p_route_ids)
      and (p_skill_group = 'all' or r.skill_group_at_round = p_skill_group)
      and r.user_id <> (select auth.uid())
      and (p_skill_group = 'all' or exists (
        select 1 from public.profiles p where p.id = (select auth.uid()) and p.skill_group = p_skill_group
      ))
      and r.total_score is not null
    group by r.id, r.user_id, r.total_score
  )
  select
    count(*)::bigint,
    round(avg(total_score), 1),
    round(avg(total_putts), 1),
    round(avg(100.0 * fairway_hits / nullif(fairway_opportunities, 0)), 1),
    round(avg(100.0 * greens_hit / nullif(holes_played, 0)), 1)
  from per_round
  having count(distinct user_id) >= 5;
$$;
revoke all on function public.get_course_round_aggregate(uuid, text, text, uuid[]) from public;
grant execute on function public.get_course_round_aggregate(uuid, text, text, uuid[]) to authenticated;

create table if not exists public.round_shots (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  hole_number smallint not null check (hole_number between 1 and 18),
  shot_number smallint not null check (shot_number between 1 and 30),
  club text not null,
  distance_to_pin_before integer not null check (distance_to_pin_before between 0 and 800),
  distance_to_pin_after integer not null check (distance_to_pin_after between 0 and 800),
  shot_distance integer not null check (shot_distance between 0 and 800),
  ball_lie text not null check (ball_lie in ('티', '페어웨이', '러프', '벙커', '그린', '해저드', 'OB', '해저드티', 'OB티', '홀아웃')),
  penalty smallint not null default 0 check (penalty between 0 and 5),
  recorded_at timestamptz not null default now(),
  unique (round_id, hole_number, shot_number)
);

-- Older deployments already have a compact round_shots table. Keep its legacy
-- columns for compatibility, and backfill the normalized fields used by the app.
alter table public.round_shots
  add column if not exists distance_to_pin_before integer,
  add column if not exists distance_to_pin_after integer,
  add column if not exists shot_distance integer,
  add column if not exists ball_lie text,
  add column if not exists penalty smallint not null default 0,
  add column if not exists recorded_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'round_shots' and column_name = 'remaining_dist'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'round_shots' and column_name = 'shot_dist'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'round_shots' and column_name = 'lie'
  ) then
    execute $backfill$
      update public.round_shots
      set distance_to_pin_before = greatest(0, least(remaining_dist, 800)),
          distance_to_pin_after = greatest(0, least(remaining_dist - shot_dist, 800)),
          shot_distance = greatest(0, least(shot_dist, 800)),
          ball_lie = case lie
            when '티잉그라운드' then '티'
            when '홀컵' then '홀아웃'
            when '홀아웃' then '홀아웃'
            when '티' then '티'
            when '페어웨이' then '페어웨이'
            when '러프' then '러프'
            when '벙커' then '벙커'
            when '그린' then '그린'
            when '해저드' then '해저드'
            when 'OB' then 'OB'
            when '해저드티' then '해저드티'
            when 'OB티' then 'OB티'
            else '러프'
          end
      where distance_to_pin_before is null
         or distance_to_pin_after is null
         or shot_distance is null
         or ball_lie is null
    $backfill$;
  end if;
end;
$$;

alter table public.round_shots
  alter column distance_to_pin_before set not null,
  alter column distance_to_pin_after set not null,
  alter column shot_distance set not null,
  alter column ball_lie set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.round_shots'::regclass and conname = 'round_shots_distance_before_range') then
    alter table public.round_shots add constraint round_shots_distance_before_range
      check (distance_to_pin_before between 0 and 800);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.round_shots'::regclass and conname = 'round_shots_distance_after_range') then
    alter table public.round_shots add constraint round_shots_distance_after_range
      check (distance_to_pin_after between 0 and 800);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.round_shots'::regclass and conname = 'round_shots_shot_distance_range') then
    alter table public.round_shots add constraint round_shots_shot_distance_range
      check (shot_distance between 0 and 800);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.round_shots'::regclass and conname = 'round_shots_ball_lie_allowed') then
    alter table public.round_shots add constraint round_shots_ball_lie_allowed
      check (ball_lie in ('티', '페어웨이', '러프', '벙커', '그린', '해저드', 'OB', '해저드티', 'OB티', '홀아웃'));
  end if;
end;
$$;

create unique index if not exists round_shots_round_hole_shot_uidx
  on public.round_shots (round_id, hole_number, shot_number);
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

-- Friend comparisons are available only after an explicit request/acceptance and
-- only for rounds the owner marked as friends-visible.
create table if not exists public.friend_connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> addressee_id),
  unique (requester_id, addressee_id)
);
create unique index if not exists friend_connections_pair_uidx
  on public.friend_connections (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create or replace function public.guard_friend_connection_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.requester_id <> old.requester_id or new.addressee_id <> old.addressee_id then
    raise exception 'Friend request participants cannot be changed';
  end if;
  if old.status <> 'pending' or new.status not in ('accepted', 'rejected')
    or (select auth.uid()) <> old.addressee_id then
    raise exception 'Only the recipient can accept or reject a pending request';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists guard_friend_connection_update on public.friend_connections;
create trigger guard_friend_connection_update
  before update on public.friend_connections
  for each row execute function public.guard_friend_connection_update();
alter table public.friend_connections enable row level security;
drop policy if exists "participants can read friend requests" on public.friend_connections;
create policy "participants can read friend requests" on public.friend_connections
  for select using (auth.uid() in (requester_id, addressee_id));
drop policy if exists "users can request friends" on public.friend_connections;
create policy "users can request friends" on public.friend_connections
  for insert with check (auth.uid() = requester_id and status = 'pending');
drop policy if exists "recipients can respond to friend requests" on public.friend_connections;
create policy "recipients can respond to friend requests" on public.friend_connections
  for update using (auth.uid() = addressee_id and status = 'pending')
  with check (auth.uid() = addressee_id and status in ('accepted', 'rejected'));
drop policy if exists "participants can remove friend connections" on public.friend_connections;
create policy "participants can remove friend connections" on public.friend_connections
  for delete using (auth.uid() in (requester_id, addressee_id));

create or replace function public.get_friend_round_aggregate(
  p_friend_id uuid,
  p_course_id uuid default null,
  p_play_mode text default null,
  p_route_ids uuid[] default null
)
returns table (sample_size bigint, average_score numeric, average_putts numeric)
language sql stable security definer set search_path = ''
as $$
  select count(*)::bigint, round(avg(r.total_score), 1), round(avg(r.total_putts), 1)
  from public.rounds r
  where (select auth.uid()) is not null
    and exists (
      select 1 from public.friend_connections f
      where f.status = 'accepted'
        and ((f.requester_id = (select auth.uid()) and f.addressee_id = p_friend_id)
          or (f.addressee_id = (select auth.uid()) and f.requester_id = p_friend_id))
    )
    and r.user_id = p_friend_id and r.status = 'completed'
    and r.visibility = 'friends' and r.total_score is not null
    and (p_course_id is null or r.course_id = p_course_id)
    and (p_play_mode is null or r.play_mode = p_play_mode)
    and (p_route_ids is null or r.route_ids = p_route_ids);
$$;
revoke all on function public.get_friend_round_aggregate(uuid, uuid, text, uuid[]) from public;
grant execute on function public.get_friend_round_aggregate(uuid, uuid, text, uuid[]) to authenticated;
