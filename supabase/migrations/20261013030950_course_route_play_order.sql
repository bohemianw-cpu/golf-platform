-- Preserve the configured tee-off order for routes whose physical hole labels
-- do not run from 1 through 9 (for example, an 8 -> 9 -> 1 route).
alter table public.golf_course_holes
  add column if not exists play_order smallint;

update public.golf_course_holes
set play_order = hole_number
where play_order is null;

alter table public.golf_course_holes
  alter column play_order set not null,
  alter column play_order set default 1;

alter table public.golf_course_holes
  drop constraint if exists golf_course_holes_play_order_check;
alter table public.golf_course_holes
  add constraint golf_course_holes_play_order_check check (play_order between 1 and 18);

create index if not exists golf_course_holes_route_play_order_idx
  on public.golf_course_holes (route_id, play_order);
