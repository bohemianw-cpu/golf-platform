-- Some official course layouts include par-6 holes. Keep the catalog,
-- round setup, and admin importer aligned with those published scorecards.
alter table public.golf_course_holes
  drop constraint if exists golf_course_holes_par_check;
alter table public.golf_course_holes
  add constraint golf_course_holes_par_check
  check (par between 3 and 6);

alter table public.golf_course_hole_tees
  drop constraint if exists golf_course_hole_tees_par_check;
alter table public.golf_course_hole_tees
  add constraint golf_course_hole_tees_par_check
  check (par between 3 and 6);
