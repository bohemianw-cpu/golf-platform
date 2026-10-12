-- Keep official-source discrepancies and administrator review context with
-- catalog rows so pending data remains explainable in production.
alter table public.golf_courses
  add column if not exists review_notes text[] not null default '{}';

alter table public.golf_course_routes
  add column if not exists review_notes text[] not null default '{}';

comment on column public.golf_courses.review_notes is
  'Administrator review context for course-level source or catalog discrepancies.';

comment on column public.golf_course_routes.review_notes is
  'Administrator review context for route-level source or hole-distance discrepancies.';
