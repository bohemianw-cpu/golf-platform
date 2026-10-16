-- get_my_trophy_stats counts only the caller's own rounds and handles the trophy boundaries exactly:
-- average putts of exactly 1.8, a 250 m drive, and an even-par 18-hole round. Anonymous visitors cannot call it.
set session_replication_role = replica;
insert into auth.users (id) values ('00000000-0000-4000-8000-0000000000aa');
insert into public.rounds (id, user_id, club_name, golf_club, course_name, play_mode, entry_mode, holes_count, status, registered_at, total_score)
values
  ('00000000-0000-4000-8000-0000000a0001', '00000000-0000-4000-8000-0000000000aa', 'A', 'A', 'OUT', 'field', 'live', 10, 'completed', now(), 40),
  ('00000000-0000-4000-8000-0000000a0002', '00000000-0000-4000-8000-0000000000aa', 'B', 'B', 'OUT', 'field', 'live', 18, 'completed', now(), 72);
-- 10홀, 퍼트 합계 18 → 홀당 정확히 1.8
insert into public.round_holes (round_id, hole_number, par, score, putts, fairway_hit, gir, total_distance)
select '00000000-0000-4000-8000-0000000a0001', n, 4, 4, case when n <= 2 then 1 else 2 end, true, null, 360 from generate_series(1, 10) n;
-- 18홀 이븐파, 퍼트 2개씩
insert into public.round_holes (round_id, hole_number, par, score, putts, fairway_hit, gir, total_distance)
select '00000000-0000-4000-8000-0000000a0002', n, 4, 4, 2, null, null, 360 from generate_series(1, 18) n;
insert into public.round_shots (round_id, hole_number, shot_number, club, distance_to_pin_before, distance_to_pin_after, shot_distance, ball_lie, penalty, lie, remaining_dist)
values ('00000000-0000-4000-8000-0000000a0002', 1, 1, 'Driver', 360, 110, 250, '페어웨이', 0, '페어웨이', 110);
set session_replication_role = origin;

do $$
begin
  if has_function_privilege('anon', 'public.get_my_trophy_stats(uuid[])', 'execute') then
    raise exception 'Anonymous visitors can read trophy stats';
  end if;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000aa', false);

do $$
declare
  s record;
begin
  -- 다른 사용자의 등록 라운드(f001: 파3 3타, 그린 미적중, 퍼터 샷)를 함께 넘겨도 빠져야 한다.
  select * into s from public.get_my_trophy_stats(array[
    '00000000-0000-4000-8000-0000000a0001',
    '00000000-0000-4000-8000-0000000a0002',
    '00000000-0000-4000-8000-00000000f001'
  ]::uuid[]);
  if s.birdies <> 0 or s.eagles <> 0 then raise exception 'Unexpected birdies or eagles: %', s; end if;
  if s.fairway_holes <> 10 or s.fairway_hits <> 10 then raise exception 'Fairway counts are wrong: %', s; end if;
  if s.gir_holes <> 0 or s.gir_hits <> 0 then raise exception 'Another user''s hole was counted: %', s; end if;
  if s.best_full_round_score is distinct from 72 then raise exception 'Best 18-hole score is wrong: %', s; end if;
  if not s.has_even_par_round or s.has_under_par_round then raise exception 'Even/under par flags are wrong: %', s; end if;
  if not s.has_putt_rhythm_round then raise exception 'An average of exactly 1.8 putts must count: %', s; end if;
  if not s.has_long_drive then raise exception 'A 250 m driver shot must count: %', s; end if;
  if not s.has_clean_round then raise exception 'A round with only penalty-free shots must count: %', s; end if;
  if not s.has_par_or_better_nine then raise exception 'Nine par-or-better holes must count: %', s; end if;

  select * into s from public.get_my_trophy_stats(array['00000000-0000-4000-8000-00000000f001']::uuid[]);
  if s.gir_holes <> 0 or s.has_clean_round or s.best_full_round_score is not null then
    raise exception 'Only another user''s round was passed, but it was counted: %', s;
  end if;
end $$;

reset role;
