-- Distinguish a named, selectable tee from an official reference distance
-- whose tee group is not disclosed by the source.
alter table public.golf_course_hole_tees
  add column if not exists tee_selection_available boolean not null default true;

update public.golf_course_hole_tees
set tee_selection_available = false
where tee_code = 'official';
update public.golf_course_hole_tees
set tee_selection_available = false
where tee_code = 'official_reference';

comment on column public.golf_course_hole_tees.tee_selection_available is
  'True when this row represents an explicitly named playable tee; false for a source-published reference distance with no tee identity.';
