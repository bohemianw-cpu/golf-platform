-- Use the same consented, completed rounds that already rank course search.
-- Return only course metadata; usage totals stay on the server.
create or replace function public.list_popular_verified_golf_courses(
  p_play_mode text,
  p_screen_provider text default null
)
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
  with usage as (
    select r.course_id, count(*)::bigint as usage_count
    from public.rounds r
    join public.user_data_preferences p
      on p.user_id = r.user_id and p.allow_anonymous_aggregate
    where r.status = 'completed'
      and r.visibility = 'aggregate'
      and r.course_id is not null
      and r.play_mode = p_play_mode
      and (p_play_mode <> 'screen' or r.screen_provider = p_screen_provider)
    group by r.course_id
  )
  select c.id, c.name, c.region, c.venue_kind,
    c.supports_field, c.supports_screen, c.hole_count, c.aliases
  from public.golf_courses c
  left join usage u on u.course_id = c.id
  where (select auth.uid()) is not null
    and c.verification_status = 'verified'
    and (
      (p_play_mode = 'field' and c.supports_field and exists (
        select 1 from public.golf_course_routes route
        where route.course_id = c.id
          and route.play_mode = 'field'
          and route.verification_status = 'verified'
      ))
      or (p_play_mode = 'screen' and nullif(trim(p_screen_provider), '') is not null
        and c.supports_screen and exists (
          select 1 from public.golf_course_routes route
          where route.course_id = c.id
            and route.play_mode = 'screen'
            and route.screen_provider = p_screen_provider
            and route.verification_status = 'verified'
        ))
    )
  order by coalesce(u.usage_count, 0) desc, c.name collate "C", c.id
  limit 8;
$$;

revoke all on function public.list_popular_verified_golf_courses(text, text) from public, anon;
grant execute on function public.list_popular_verified_golf_courses(text, text) to authenticated;
