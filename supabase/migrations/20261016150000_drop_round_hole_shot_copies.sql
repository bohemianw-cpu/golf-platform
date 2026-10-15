-- 샷 기록은 round_shots 한 곳에만 둔다. 앱은 PR #7부터 round_holes.shots에 쓰지 않았고,
-- 20261016140000 마이그레이션으로 사본에만 있던 샷(운영 36홀, 176샷)을 모두 round_shots로 옮겼다.
-- 2026-10-16 운영 점검에서 사본에만 샷이 있는 홀이 0개임을 확인한 뒤 사본 컬럼을 지운다.
alter table public.round_holes drop column if exists shots;

comment on table public.round_shots is
  'Per-shot records for each round hole, synchronized across devices. The only store of shot details.';
