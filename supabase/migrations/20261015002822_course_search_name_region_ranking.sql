-- Put literal golf-course name matches ahead of aliases and region matches.
-- Within each match position, rank by opted-in completed round usage.
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
    where r.status = 'completed'
      and r.visibility = 'aggregate'
      and r.course_id is not null
    group by r.course_id
  ), candidates as (
    select
      c.id,
      c.name,
      c.region,
      c.venue_kind,
      c.supports_field,
      c.supports_screen,
      c.hole_count,
      c.aliases,
      name_match.position as name_position,
      alias_match.position as alias_position,
      region_match.position as region_position,
      coalesce(u.usage_count, 0) as usage_count
    from public.golf_courses c
    cross join search_term q
    left join lateral (
      select min(match.position) as position
      from (
        select nullif(strpos(regexp_replace(lower(c.name), '[[:space:]·ㆍ()（）.,_-]', '', 'g'), q.value), 0) as position
        union all
        select nullif(strpos(c.normalized_name, q.value), 0)
      ) match
    ) name_match on true
    left join lateral (
      select min(match.position) as position
      from (
        select nullif(strpos(regexp_replace(lower(alias_name.value), '[[:space:]·ㆍ()（）.,_-]', '', 'g'), q.value), 0) as position
        from unnest(c.aliases) as alias_name(value)
      ) match
    ) alias_match on true
    left join lateral (
      select nullif(strpos(regexp_replace(lower(coalesce(c.region, '')), '[[:space:]·ㆍ()（）.,_-]', '', 'g'), q.value), 0) as position
    ) region_match on true
    left join usage u on u.course_id = c.id
    where c.verification_status = 'verified'
      and q.value <> ''
      and (name_match.position is not null or alias_match.position is not null or region_match.position is not null)
  )
  select c.id, c.name, c.region, c.venue_kind, c.supports_field, c.supports_screen, c.hole_count, c.aliases
  from candidates c
  where (select auth.uid()) is not null
  order by
    case
      when c.name_position = 1 then 0
      when c.name_position is not null then 1
      when c.alias_position = 1 then 2
      when c.alias_position is not null then 3
      when c.region_position = 1 then 4
      else 5
    end,
    coalesce(c.name_position, c.alias_position, c.region_position),
    c.usage_count desc,
    c.name collate "C",
    c.id
  limit 1000;
$$;

revoke all on function public.search_verified_golf_courses(text) from public, anon;
grant execute on function public.search_verified_golf_courses(text) to authenticated;
