-- get_my_round_overview summarises only the caller's rounds: totals, the completed-round average and best score,
-- and the rounds that count for levels and trophies (registered and passed the time check). Anonymous visitors cannot call it.
set session_replication_role = replica;
insert into auth.users (id) values ('00000000-0000-4000-8000-0000000000aa');
insert into public.rounds (id, user_id, club_name, golf_club, course_name, play_mode, entry_mode, holes_count, status, registered_at, total_score)
values
  -- 인정: 등록 + 시간 확인 통과
  ('00000000-0000-4000-8000-0000000b0001', '00000000-0000-4000-8000-0000000000aa', 'A', 'A', 'OUT', 'field', 'live', 18, 'completed', now(), 80),
  -- 완료지만 기록 확인 필요
  ('00000000-0000-4000-8000-0000000b0002', '00000000-0000-4000-8000-0000000000aa', 'B', 'B', 'OUT', 'field', 'live', 18, 'completed', now(), 90),
  -- 완료지만 등록 전 (시간 확인은 통과)
  ('00000000-0000-4000-8000-0000000b0003', '00000000-0000-4000-8000-0000000000aa', 'C', 'C', 'OUT', 'field', 'live', 18, 'completed', null, 100),
  -- 진행 중
  ('00000000-0000-4000-8000-0000000b0004', '00000000-0000-4000-8000-0000000000aa', 'D', 'D', 'OUT', 'field', 'live', 18, 'in_progress', null, null);
insert into public.round_integrity (round_id, user_id, started_at, status)
values
  ('00000000-0000-4000-8000-0000000b0001', '00000000-0000-4000-8000-0000000000aa', now(), 'time_plausible'),
  ('00000000-0000-4000-8000-0000000b0002', '00000000-0000-4000-8000-0000000000aa', now(), 'review_required'),
  ('00000000-0000-4000-8000-0000000b0003', '00000000-0000-4000-8000-0000000000aa', now(), 'time_plausible');
set session_replication_role = origin;

do $$
begin
  if has_function_privilege('anon', 'public.get_my_round_overview()', 'execute') then
    raise exception 'Anonymous visitors can read the round overview';
  end if;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000aa', false);

do $$
declare
  s record;
begin
  select * into s from public.get_my_round_overview();
  -- 시드의 다른 사용자 라운드 2개(진행 중, 등록됨)는 세지 않는다.
  if s.total_rounds <> 4 or s.completed_rounds <> 3 then raise exception 'Round counts are wrong: %', s; end if;
  if s.average_score <> 90 or s.best_score <> 80 then raise exception 'Average or best score is wrong: %', s; end if;
  if s.achievement_round_ids <> array['00000000-0000-4000-8000-0000000b0001']::uuid[] then
    raise exception 'Only the registered, time-checked round should count: %', s;
  end if;
end $$;

-- 라운드가 없는 사용자는 0과 빈 목록을 받는다.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000cc', false);
do $$
declare
  s record;
begin
  select * into s from public.get_my_round_overview();
  if s.total_rounds <> 0 or s.completed_rounds <> 0 or s.average_score is not null or s.best_score is not null or s.achievement_round_ids <> '{}'::uuid[] then
    raise exception 'A user without rounds should get an empty overview: %', s;
  end if;
end $$;

reset role;
