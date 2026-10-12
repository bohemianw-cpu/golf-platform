alter table public.golf_course_routes
  add column if not exists source_data_url text;

comment on column public.golf_course_routes.source_data_url is
  'Optional direct official data source URL for the route, alongside the human-readable source_url.';
