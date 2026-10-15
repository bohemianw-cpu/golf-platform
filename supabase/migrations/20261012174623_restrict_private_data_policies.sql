-- Remove legacy permissive policies that bypass the owner checks below.
-- PostgreSQL combines permissive policies with OR, so a single USING (true)
-- policy makes the table readable/writable even when owner policies exist.
drop policy if exists rounds_all on public.rounds;
drop policy if exists shots_all on public.round_shots;
drop policy if exists user_clubs_all on public.user_clubs;
drop policy if exists inquiries_all on public.lesson_inquiries;

-- Aggregate and profile mutation RPCs are intended for signed-in users only.
revoke all on function public.get_course_round_aggregate(uuid, text, text, uuid[]) from public, anon;
grant execute on function public.get_course_round_aggregate(uuid, text, text, uuid[]) to authenticated;

revoke all on function public.get_friend_round_aggregate(uuid, uuid, text, uuid[]) from public, anon;
grant execute on function public.get_friend_round_aggregate(uuid, uuid, text, uuid[]) to authenticated;

revoke all on function public.update_my_golf_level(numeric) from public, anon;
grant execute on function public.update_my_golf_level(numeric) to authenticated;

-- These functions are invoked by database triggers, never through the client RPC API.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.sync_golf_profile_from_auth_user() from public, anon, authenticated;

-- RLS may call this helper while evaluating signed-in user policies.
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
