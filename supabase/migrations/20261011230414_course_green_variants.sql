-- Preserve per-green tee distances and the green selected for each played hole.
alter table public.golf_course_hole_tees
  add column if not exists green_code text not null default 'standard'
    check (length(trim(green_code)) > 0),
  add column if not exists green_name text not null default '기본 그린'
    check (length(trim(green_name)) > 0);

alter table public.golf_course_hole_tees
  drop constraint if exists golf_course_hole_tees_hole_id_tee_code_key;
alter table public.golf_course_hole_tees
  drop constraint if exists golf_course_hole_tees_hole_tee_green_key;
alter table public.golf_course_hole_tees
  add constraint golf_course_hole_tees_hole_tee_green_key
  unique (hole_id, tee_code, green_code);

drop index if exists public.golf_course_hole_tees_hole_tee_idx;
create index if not exists golf_course_hole_tees_hole_tee_green_idx
  on public.golf_course_hole_tees (hole_id, tee_code, green_code);

alter table public.round_holes
  add column if not exists green_code text not null default 'standard'
    check (length(trim(green_code)) > 0),
  add column if not exists green_name text not null default '기본 그린'
    check (length(trim(green_name)) > 0);

comment on column public.golf_course_hole_tees.green_code is
  'Stable green side identifier, such as standard, left, or right.';
comment on column public.golf_course_hole_tees.green_name is
  'Human-readable official green side label.';
comment on column public.round_holes.green_code is
  'Green side played for this hole; legacy records use standard.';
