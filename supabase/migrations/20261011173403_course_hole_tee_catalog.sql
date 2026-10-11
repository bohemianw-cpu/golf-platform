-- Store a verified course layout as route -> hole -> available tee distances.
-- Missing tee rows are intentional and mean that tee is unavailable for that hole.

alter table public.golf_course_routes
  add column if not exists source_url text,
  add column if not exists source_checked_at timestamptz;

create table if not exists public.golf_course_holes (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.golf_course_routes(id) on delete cascade,
  hole_number smallint not null check (hole_number between 1 and 18),
  par smallint not null check (par between 3 and 5),
  handicap_index smallint check (handicap_index between 1 and 18),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (route_id, hole_number)
);

create table if not exists public.golf_course_hole_tees (
  id uuid primary key default gen_random_uuid(),
  hole_id uuid not null references public.golf_course_holes(id) on delete cascade,
  tee_code text not null check (length(trim(tee_code)) > 0),
  display_name text not null check (length(trim(display_name)) > 0),
  tee_color text not null check (length(trim(tee_color)) > 0),
  distance_m smallint not null check (distance_m between 1 and 800),
  source_distance integer,
  source_unit text check (source_unit in ('m', 'yd')),
  created_at timestamptz not null default now(),
  unique (hole_id, tee_code)
);

create index if not exists golf_course_holes_route_hole_idx
  on public.golf_course_holes (route_id, hole_number);
create index if not exists golf_course_hole_tees_hole_tee_idx
  on public.golf_course_hole_tees (hole_id, tee_code);

alter table public.rounds
  add column if not exists tee_code text,
  add column if not exists tee_name text;

alter table public.golf_course_holes enable row level security;
alter table public.golf_course_hole_tees enable row level security;

drop policy if exists "verified course holes are readable" on public.golf_course_holes;
create policy "verified course holes are readable" on public.golf_course_holes
  for select using (exists (
    select 1
    from public.golf_course_routes r
    join public.golf_courses c on c.id = r.course_id
    where r.id = route_id
      and r.verification_status = 'verified'
      and c.verification_status = 'verified'
  ));

drop policy if exists "verified course tee distances are readable" on public.golf_course_hole_tees;
create policy "verified course tee distances are readable" on public.golf_course_hole_tees
  for select using (exists (
    select 1
    from public.golf_course_holes h
    join public.golf_course_routes r on r.id = h.route_id
    join public.golf_courses c on c.id = r.course_id
    where h.id = hole_id
      and r.verification_status = 'verified'
      and c.verification_status = 'verified'
  ));

comment on table public.golf_course_routes is
  'Verified playable route segments (e.g. OUT, IN); tee-specific hole data is stored in golf_course_holes and golf_course_hole_tees.';
comment on table public.golf_course_holes is
  'One row per hole in a course route, including par and optional official handicap index.';
comment on table public.golf_course_hole_tees is
  'One row for each tee actually published for a hole; absent tee rows must not be inferred.';
