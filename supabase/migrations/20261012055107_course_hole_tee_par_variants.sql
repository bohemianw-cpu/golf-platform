-- Some courses change a hole's par along with the selected green or layout.
-- Preserve the configured par with each tee/green distance so round setup can
-- select the actual value and snapshot it into round_holes.par.
alter table public.golf_course_hole_tees
  add column if not exists par smallint check (par between 3 and 5);

comment on column public.golf_course_hole_tees.par is
  'Optional par override for this tee/green configuration when the course changes a hole par by layout. Null inherits golf_course_holes.par.';
