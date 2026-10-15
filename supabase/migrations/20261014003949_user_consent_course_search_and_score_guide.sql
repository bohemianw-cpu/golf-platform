-- Keep consent choices separate from profile data (which has historically been
-- readable by other clients) and retain a minimal append-only decision trail.
create table if not exists public.user_data_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  allow_anonymous_aggregate boolean not null default false,
  allow_friend_sharing boolean not null default false,
  score_guide_enabled boolean not null default true,
  score_guide_completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_data_consent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_kind text not null check (consent_kind in ('anonymous_aggregate', 'friend_sharing')),
  granted boolean not null,
  policy_version text not null,
  source text not null check (source in ('signup', 'settings')),
  created_at timestamptz not null default now()
);

alter table public.user_data_preferences enable row level security;
alter table public.user_data_consent_events enable row level security;

drop policy if exists "users read their data preferences" on public.user_data_preferences;
create policy "users read their data preferences" on public.user_data_preferences
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "users read their consent history" on public.user_data_consent_events;
create policy "users read their consent history" on public.user_data_consent_events
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.user_data_preferences, public.user_data_consent_events from public, anon, authenticated;
grant select on public.user_data_preferences, public.user_data_consent_events to authenticated;

-- Existing members start with optional data sharing off. This does not infer
-- consent from historic round visibility flags.
insert into public.user_data_preferences (user_id)
select id from auth.users
on conflict (user_id) do nothing;

create index if not exists rounds_course_consented_usage_idx
  on public.rounds (course_id)
  where status = 'completed' and visibility = 'aggregate' and course_id is not null;

create or replace function public.capture_signup_data_preferences()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aggregate boolean := coalesce(new.raw_user_meta_data ->> 'allow_anonymous_aggregate', 'false') = 'true';
  v_friends boolean := coalesce(new.raw_user_meta_data ->> 'allow_friend_sharing', 'false') = 'true';
  v_policy_version text := '2026-10-14-v1';
begin
  insert into public.user_data_preferences (user_id, allow_anonymous_aggregate, allow_friend_sharing)
  values (new.id, v_aggregate, v_friends)
  on conflict (user_id) do nothing;

  insert into public.user_data_consent_events (user_id, consent_kind, granted, policy_version, source)
  values
    (new.id, 'anonymous_aggregate', v_aggregate, v_policy_version, 'signup'),
    (new.id, 'friend_sharing', v_friends, v_policy_version, 'signup');
  return new;
end;
$$;
revoke all on function public.capture_signup_data_preferences() from public, anon, authenticated;
drop trigger if exists capture_signup_data_preferences on auth.users;
create trigger capture_signup_data_preferences
  after insert on auth.users
  for each row execute function public.capture_signup_data_preferences();

create or replace function public.set_my_data_sharing_preference(
  p_preference text,
  p_enabled boolean,
  p_policy_version text default '2026-10-14-v1'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_policy_version text := coalesce(nullif(trim(p_policy_version), ''), '2026-10-14-v1');
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_preference is null or p_preference not in ('anonymous_aggregate', 'friend_sharing') then
    raise exception 'Unsupported data sharing preference';
  end if;
  if p_enabled is null then raise exception 'Preference value is required'; end if;
  if v_policy_version <> '2026-10-14-v1' then
    raise exception 'Consent text version is no longer current';
  end if;

  insert into public.user_data_preferences (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  if p_preference = 'anonymous_aggregate' then
    update public.user_data_preferences
    set allow_anonymous_aggregate = p_enabled, updated_at = now()
    where user_id = v_user_id;
    if not p_enabled then
      update public.rounds set visibility = 'private'
      where user_id = v_user_id and visibility = 'aggregate';
    end if;
  else
    update public.user_data_preferences
    set allow_friend_sharing = p_enabled, updated_at = now()
    where user_id = v_user_id;
    if not p_enabled then
      update public.rounds set visibility = 'private'
      where user_id = v_user_id and visibility = 'friends';
    end if;
  end if;

  insert into public.user_data_consent_events (user_id, consent_kind, granted, policy_version, source)
  values (v_user_id, p_preference, p_enabled, v_policy_version, 'settings');
end;
$$;
revoke all on function public.set_my_data_sharing_preference(text, boolean, text) from public, anon;
grant execute on function public.set_my_data_sharing_preference(text, boolean, text) to authenticated;

create or replace function public.set_my_score_guide_preference(p_enabled boolean, p_completed boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_enabled is null then raise exception 'Preference value is required'; end if;
  insert into public.user_data_preferences as existing (user_id, score_guide_enabled, score_guide_completed_at)
  values (v_user_id, p_enabled, case when p_completed then now() else null end)
  on conflict (user_id) do update set
    score_guide_enabled = excluded.score_guide_enabled,
    score_guide_completed_at = case when p_completed
      then coalesce(existing.score_guide_completed_at, now())
      else existing.score_guide_completed_at end,
    updated_at = now();
end;
$$;
revoke all on function public.set_my_score_guide_preference(boolean, boolean) from public, anon;
grant execute on function public.set_my_score_guide_preference(boolean, boolean) to authenticated;

-- A course picker may use only consented, completed round counts for ranking.
-- Counts are used for ordering only and are never exposed to the client.
create or replace function public.search_verified_golf_courses(p_query text)
returns table (
  id uuid,
  name text,
  region text,
  venue_kind text,
  supports_field boolean,
  supports_screen boolean,
  hole_count smallint,
  aliases text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  with search_term as (
    select regexp_replace(lower(coalesce(trim(p_query), '')), '[[:space:]·ㆍ()（）.,_-]', '', 'g') as value
  ), usage as (
    select r.course_id, count(*)::bigint as usage_count
    from public.rounds r
    join public.user_data_preferences p
      on p.user_id = r.user_id and p.allow_anonymous_aggregate
    where r.status = 'completed' and r.visibility = 'aggregate' and r.course_id is not null
    group by r.course_id
  ), candidates as (
    select c.id, c.name, c.region, c.venue_kind, c.supports_field, c.supports_screen, c.hole_count, c.aliases,
      name_match.position as name_position,
      region_match.position as region_position,
      coalesce(u.usage_count, 0) as usage_count
    from public.golf_courses c
    cross join search_term q
    left join lateral (
      select min(m.position) as position
      from (
        select nullif(strpos(regexp_replace(lower(c.name), '[[:space:]·ㆍ()（）.,_-]', '', 'g'), q.value), 0) as position
        union all
        select nullif(strpos(c.normalized_name, q.value), 0)
        union all
        select nullif(strpos(regexp_replace(lower(alias_name.value), '[[:space:]·ㆍ()（）.,_-]', '', 'g'), q.value), 0)
        from unnest(c.aliases) as alias_name(value)
      ) m
    ) name_match on true
    left join lateral (
      select nullif(strpos(regexp_replace(lower(coalesce(c.region, '')), '[[:space:]·ㆍ()（）.,_-]', '', 'g'), q.value), 0) as position
    ) region_match on true
    left join usage u on u.course_id = c.id
    where c.verification_status = 'verified'
      and q.value <> ''
      and (name_match.position is not null or region_match.position is not null)
  )
  select c.id, c.name, c.region, c.venue_kind, c.supports_field, c.supports_screen, c.hole_count, c.aliases
  from candidates c
  where (select auth.uid()) is not null
  order by
    case when c.name_position = 1 then 0
      when c.name_position is not null then 1
      when c.region_position = 1 then 2 else 3 end,
    coalesce(c.name_position, c.region_position),
    c.usage_count desc,
    c.name collate "C",
    c.id
  limit 512;
$$;
revoke all on function public.search_verified_golf_courses(text) from public, anon;
grant execute on function public.search_verified_golf_courses(text) to authenticated;

-- Anonymous comparisons only include participants who opted in at signup or
-- changed this preference later. Keep returning aggregates only (no identities).
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
    select r.id, r.user_id, r.total_score,
      sum(h.putts)::numeric as total_putts,
      count(*) filter (where h.fairway_hit is not null) as fairway_opportunities,
      count(*) filter (where h.fairway_hit = true) as fairway_hits,
      count(*) as holes_played,
      count(*) filter (where h.gir = true) as greens_hit
    from public.rounds r
    join public.round_holes h on h.round_id = r.id
    join public.user_data_preferences consent
      on consent.user_id = r.user_id and consent.allow_anonymous_aggregate
    where r.status = 'completed'
      and r.visibility = 'aggregate'
      and (p_course_id is null or r.course_id = p_course_id)
      and (p_play_mode is null or r.play_mode = p_play_mode)
      and (p_route_ids is null or r.route_ids = p_route_ids)
      and (p_skill_group = 'all' or r.skill_group_at_round = p_skill_group)
      and r.user_id <> (select auth.uid())
      and (p_skill_group = 'all' or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.skill_group = p_skill_group
      ))
      and r.total_score is not null
    group by r.id, r.user_id, r.total_score
  )
  select count(*)::bigint,
    round(avg(total_score), 1),
    round(avg(total_putts), 1),
    round(avg(100.0 * fairway_hits / nullif(fairway_opportunities, 0)), 1),
    round(avg(100.0 * greens_hit / nullif(holes_played, 0)), 1)
  from per_round
  having count(distinct user_id) >= 5;
$$;

create or replace function public.get_friend_round_aggregate(
  p_friend_id uuid,
  p_course_id uuid default null,
  p_play_mode text default null,
  p_route_ids uuid[] default null
)
returns table (sample_size bigint, average_score numeric, average_putts numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::bigint, round(avg(r.total_score), 1), round(avg(r.total_putts), 1)
  from public.rounds r
  join public.user_data_preferences consent
    on consent.user_id = r.user_id and consent.allow_friend_sharing
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

-- The legacy broad SELECT policies expose profile fields such as email. Replace
-- them with an authenticated self-only read policy.
alter table public.profiles enable row level security;
drop policy if exists "모든 사용자가 닉네임 조회가 가능합니다" on public.profiles;
drop policy if exists "프로필 공개 조회" on public.profiles;
drop policy if exists "본인 프로필 조회 허용" on public.profiles;
drop policy if exists "profiles_select_policy" on public.profiles;
drop policy if exists "profiles_read_all" on public.profiles;
drop policy if exists "profiles_public_read" on public.profiles;
drop policy if exists "프로필 생성 허용" on public.profiles;
drop policy if exists "본인 프로필 등록/수정 허용" on public.profiles;
drop policy if exists "본인 프로필 수정 허용" on public.profiles;
drop policy if exists "본인 프로필 업데이트 허용" on public.profiles;
drop policy if exists "본인 프로필만 수정" on public.profiles;
drop policy if exists "관리자는 모든 프로필 수정" on public.profiles;
drop policy if exists "profiles owner read" on public.profiles;
revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;
create policy "profiles owner read" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
