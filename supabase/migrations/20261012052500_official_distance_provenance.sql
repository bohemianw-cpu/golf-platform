-- Distinguish independently published metric distances from converted values.
alter table public.golf_course_hole_tees
  add column if not exists distance_m_source text not null default 'converted';

alter table public.golf_course_hole_tees
  add constraint golf_course_hole_tees_distance_m_source_check
  check (distance_m_source in ('official', 'converted'));

comment on column public.golf_course_hole_tees.distance_m_source is
  'Whether distance_m was independently published by the source or converted from source_distance/source_unit.';

-- Lakeside publishes both YD and M columns; its M values are independently sourced.
update public.golf_course_hole_tees tee
set distance_m_source = 'official'
from public.golf_course_holes hole
join public.golf_course_routes route on route.id = hole.route_id
join public.golf_courses course on course.id = route.course_id
where tee.hole_id = hole.id
  and course.normalized_name = '레이크사이드cc대중제';
