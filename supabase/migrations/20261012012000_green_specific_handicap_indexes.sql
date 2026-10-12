-- Some official course catalogs publish different handicap indexes for each green.
-- Keep the index beside the tee/green variant so no source value is lost.
alter table public.golf_course_hole_tees
  add column if not exists handicap_index smallint
  check (handicap_index between 1 and 18);

comment on column public.golf_course_hole_tees.handicap_index is
  'Optional official handicap index for this tee and green variant.';
