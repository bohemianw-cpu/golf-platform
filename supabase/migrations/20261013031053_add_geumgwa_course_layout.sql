-- User-provided course card. Hole numbers are physical labels; play_order is
-- the order in which golfers enter the holes. Distances are in metres.
update public.golf_courses
set hole_count = 9,
    verification_status = 'pending',
    updated_at = now()
where name = '금과골프장' and region = '전북';

insert into public.golf_course_routes
  (course_id, route_code, display_name, hole_count, pars, distances_m, source_name, verification_status, source_url, source_data_url, review_notes)
select c.id, 'NINE_HOLES', '9홀 코스', 9,
       array[4,4,4,3,3,4,4,4,3]::smallint[],
       array[180,250,200,95,60,305,325,310,115]::smallint[],
       'admin_curated', 'pending', null, null,
       array['사용자 제공 자료: 플레이 순서 8→9→1→2→3→4→5→6→7, 거리 단위 m. 9홀 또는 동일 코스 2회(18홀) 선택 지원.']::text[]
from public.golf_courses c
where c.name = '금과골프장' and c.region = '전북'
on conflict (course_id, route_code) do update
set display_name = excluded.display_name,
    hole_count = excluded.hole_count,
    pars = excluded.pars,
    distances_m = excluded.distances_m,
    source_name = excluded.source_name,
    verification_status = excluded.verification_status,
    source_url = excluded.source_url,
    source_data_url = excluded.source_data_url,
    review_notes = excluded.review_notes,
    updated_at = now();

delete from public.golf_course_hole_tees t
using public.golf_course_holes h, public.golf_course_routes r, public.golf_courses c
where t.hole_id = h.id and h.route_id = r.id and r.course_id = c.id
  and c.name = '금과골프장' and c.region = '전북' and r.route_code = 'NINE_HOLES';

delete from public.golf_course_holes h
using public.golf_course_routes r, public.golf_courses c
where h.route_id = r.id and r.course_id = c.id
  and c.name = '금과골프장' and c.region = '전북' and r.route_code = 'NINE_HOLES';

with route as (
  select r.id from public.golf_course_routes r
  join public.golf_courses c on c.id = r.course_id
  where c.name = '금과골프장' and c.region = '전북' and r.route_code = 'NINE_HOLES'
), holes(play_order, hole_number, par, distance_m) as (
  values
    (1,8,4,180), (2,9,4,250), (3,1,4,200),
    (4,2,3,95), (5,3,3,60), (6,4,4,305),
    (7,5,4,325), (8,6,4,310), (9,7,3,115)
), inserted_holes as (
  insert into public.golf_course_holes(route_id, hole_number, play_order, par)
  select route.id, holes.hole_number, holes.play_order, holes.par
  from route cross join holes
  returning id, hole_number, play_order
)
insert into public.golf_course_hole_tees
  (hole_id, tee_code, display_name, tee_color, tee_selection_available, distance_m, distance_m_source, source_distance, source_unit, green_code, green_name)
select inserted_holes.id, 'official_reference', '기준 거리', '#64748b', false,
       holes.distance_m, 'official', holes.distance_m, 'm', 'standard', '기본 그린'
from inserted_holes join holes using (hole_number, play_order);

update public.golf_course_routes r
set verification_status = 'verified', updated_at = now()
from public.golf_courses c
where r.course_id = c.id and c.name = '금과골프장' and c.region = '전북'
  and r.route_code = 'NINE_HOLES';

update public.golf_courses
set verification_status = 'verified', updated_at = now()
where name = '금과골프장' and region = '전북';
