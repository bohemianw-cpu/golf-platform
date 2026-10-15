alter table public.golf_course_routes
  drop constraint if exists golf_course_routes_hole_count_check;

alter table public.golf_course_routes
  add constraint golf_course_routes_hole_count_check
  check (hole_count between 1 and 18);
