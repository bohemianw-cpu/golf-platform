-- 읽기 전용: 홀마다 round_holes.shots(예전 사본)와 round_shots(기준 기록)의 샷 개수를 비교한다.
-- 샷 내용은 읽지 않고 개수만 센다.
with per_hole as (
  select h.round_id, h.hole_number, r.registered_at is not null as registered,
    jsonb_array_length(coalesce(h.shots, '[]'::jsonb)) as snapshot_shots,
    (select count(*) from public.round_shots s
      where s.round_id = h.round_id and s.hole_number = h.hole_number) as normalized_shots
  from public.round_holes h
  join public.rounds r on r.id = h.round_id
),
checks("순서", "항목", "값") as (
  select 1, '전체 홀 / 등록된 라운드의 홀',
    count(*)::text || ' / ' || count(*) filter (where registered)::text from per_hole
  union all
  select 2, '두 곳의 샷 개수가 같은 홀',
    count(*) filter (where snapshot_shots = normalized_shots)::text from per_hole
  union all
  select 3, 'round_holes.shots에만 샷이 있는 홀 (전체 / 등록됨)',
    count(*) filter (where snapshot_shots > 0 and normalized_shots = 0)::text || ' / '
      || count(*) filter (where snapshot_shots > 0 and normalized_shots = 0 and registered)::text from per_hole
  union all
  select 4, 'round_shots에만 샷이 있는 홀',
    count(*) filter (where snapshot_shots = 0 and normalized_shots > 0)::text from per_hole
  union all
  select 5, '두 곳 모두 있지만 개수가 다른 홀',
    count(*) filter (where snapshot_shots > 0 and normalized_shots > 0 and snapshot_shots <> normalized_shots)::text from per_hole
  union all
  select 6, 'round_holes.shots에만 있는 샷 수',
    coalesce(sum(snapshot_shots) filter (where normalized_shots = 0), 0)::text from per_hole
)
select "항목", "값" from checks order by "순서";
