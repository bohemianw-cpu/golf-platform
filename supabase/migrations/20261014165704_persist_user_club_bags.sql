-- A complete club bag is one account preference, including an intentionally empty bag.
create table public.user_club_bags (
  user_id uuid primary key references auth.users(id) on delete cascade,
  clubs jsonb not null,
  updated_at timestamptz not null default now(),
  constraint user_club_bags_array check (jsonb_typeof(clubs) = 'array'),
  constraint user_club_bags_limit check (jsonb_array_length(clubs) <= 14)
);

alter table public.user_club_bags enable row level security;

create policy "users read their own club bag" on public.user_club_bags
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "users create their own club bag" on public.user_club_bags
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "users update their own club bag" on public.user_club_bags
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.user_club_bags from public, anon, authenticated;
grant select, insert, update on public.user_club_bags to authenticated;
