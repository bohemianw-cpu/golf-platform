-- Preserve official layouts that publish par-seven holes (e.g. Gunsan CC).
alter table public.golf_course_holes
  drop constraint if exists golf_course_holes_par_check;
alter table public.golf_course_holes
  add constraint golf_course_holes_par_check
  check (par between 3 and 7);

alter table public.golf_course_hole_tees
  drop constraint if exists golf_course_hole_tees_par_check;
alter table public.golf_course_hole_tees
  add constraint golf_course_hole_tees_par_check
  check (par between 3 and 7);

-- Keep the catalog open to official ultra-long layouts such as par-seven holes.
alter table public.golf_course_hole_tees
  drop constraint if exists golf_course_hole_tees_distance_m_check;
alter table public.golf_course_hole_tees
  add constraint golf_course_hole_tees_distance_m_check
  check (distance_m between 1 and 2000);
