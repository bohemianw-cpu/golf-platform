-- round_shots 도입 전 홀은 샷이 round_holes.shots(사본)에만 있다. 이 샷을 round_shots로 옮겨
-- 샷 기록을 한 곳으로 모은다. 2026-10-16 운영 점검(scripts/db/check-legacy-shot-copies.sql)에서
-- 대상은 등록된 라운드의 36홀, 176샷이었고 모든 값이 round_shots 허용 범위 안이었다.

-- 등록된 라운드라 평소에는 샷 추가가 막힌다. 옮기는 동안만 아래 트리거를 끈다.
--  - protect_registered_shots: 등록된 라운드의 샷 변경 차단
--  - capture_shot_input_after_write: 입력 이력 기록. 옮긴 샷을 새 입력이나 등록 후 수정으로 남기지 않는다.
--  - lock_shot_clock_before_write: 저장 시각을 지금으로 고정. 원래 홀 저장 시각을 유지한다.
-- 예전 컬럼(lie, remaining_dist, shot_dist)은 sync_round_shot_legacy_columns 트리거가 그대로 채운다.
alter table public.round_shots disable trigger protect_registered_shots;
alter table public.round_shots disable trigger capture_shot_input_after_write;
alter table public.round_shots disable trigger lock_shot_clock_before_write;

insert into public.round_shots (
  round_id, hole_number, hole_par, shot_number, club,
  distance_to_pin_before, distance_to_pin_after, shot_distance, ball_lie, penalty,
  input_method, created_at, recorded_at
)
select
  h.round_id, h.hole_number, h.par, (e.shot ->> 'shotNumber')::integer, e.shot ->> 'club',
  (e.shot ->> 'distanceToPinBefore')::numeric, (e.shot ->> 'distanceToPinAfter')::numeric,
  (e.shot ->> 'shotDistance')::numeric, e.shot ->> 'ballLie', (e.shot ->> 'penalty')::smallint,
  case when e.shot ->> 'inputMethod' in ('manual', 'quick_putt') then e.shot ->> 'inputMethod' else 'manual' end,
  h.created_at, h.created_at
from public.round_holes h
cross join lateral jsonb_array_elements(h.shots) as e(shot)
where jsonb_array_length(coalesce(h.shots, '[]'::jsonb)) > 0
  and not exists (
    select 1 from public.round_shots s
    where s.round_id = h.round_id and s.hole_number = h.hole_number
  );

alter table public.round_shots enable trigger protect_registered_shots;
alter table public.round_shots enable trigger capture_shot_input_after_write;
alter table public.round_shots enable trigger lock_shot_clock_before_write;
