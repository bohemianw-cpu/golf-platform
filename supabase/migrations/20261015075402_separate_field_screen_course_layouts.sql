-- Keep one golf-course identity while storing independent field and
-- simulator-specific route, hole, and tee distances under that identity.
alter table public.golf_course_routes
  add column play_mode text not null default 'field',
  add column screen_provider text not null default '';

alter table public.golf_course_routes
  add constraint golf_course_routes_play_mode_check
    check (play_mode in ('field', 'screen')),
  add constraint golf_course_routes_screen_provider_check
    check ((play_mode = 'field' and screen_provider = '')
      or (play_mode = 'screen' and length(trim(screen_provider)) > 0));

alter table public.golf_course_routes
  drop constraint golf_course_routes_course_id_route_code_key;
alter table public.golf_course_routes
  add constraint golf_course_routes_mode_provider_route_key
    unique (course_id, play_mode, screen_provider, route_code);

create index golf_course_routes_screen_provider_lookup_idx
  on public.golf_course_routes (screen_provider, course_id)
  where play_mode = 'screen' and verification_status = 'verified';

alter table public.rounds
  add column screen_provider text;
alter table public.rounds
  add constraint rounds_screen_provider_mode_check
    check (screen_provider is null or play_mode = 'screen');

comment on column public.golf_course_routes.play_mode is
  'Field and screen routes are separate records even when the course and route names match.';
comment on column public.golf_course_routes.screen_provider is
  'Screen simulator/service identifier; empty for field routes.';
comment on column public.rounds.screen_provider is
  'Simulator/service used by a screen round; null for field and legacy records.';

create or replace function public.list_verified_screen_providers()
returns table (provider text)
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct r.screen_provider as provider
  from public.golf_course_routes r
  join public.golf_courses c on c.id = r.course_id
  where r.play_mode = 'screen'
    and r.verification_status = 'verified'
    and c.verification_status = 'verified'
    and c.supports_screen
  order by provider;
$$;

revoke all on function public.list_verified_screen_providers() from public, anon;
grant execute on function public.list_verified_screen_providers() to authenticated;

create or replace function public.search_verified_golf_courses_by_mode(
  p_query text,
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
security invoker
set search_path = ''
as $$
  select c.id, c.name, c.region, c.venue_kind,
    c.supports_field, c.supports_screen, c.hole_count, c.aliases
  from public.search_verified_golf_courses(p_query) c
  where (p_play_mode = 'field' and c.supports_field)
     or (p_play_mode = 'screen'
       and nullif(trim(p_screen_provider), '') is not null
       and c.supports_screen
       and exists (
         select 1
         from public.golf_course_routes r
         where r.course_id = c.id
           and r.play_mode = 'screen'
           and r.screen_provider = p_screen_provider
           and r.verification_status = 'verified'
       ));
$$;

revoke all on function public.search_verified_golf_courses_by_mode(text, text, text) from public, anon;
grant execute on function public.search_verified_golf_courses_by_mode(text, text, text) to authenticated;
