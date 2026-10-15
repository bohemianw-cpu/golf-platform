-- 읽기 전용: round_shots에 없고 round_holes.shots에만 남은 샷의 형식을 점검한다.
-- 클럽 이름 같은 내용은 읽지 않고, 필드 이름과 값이 허용 범위인지만 센다.
with legacy_holes as (
  select h.round_id, h.hole_number, h.shots
  from public.round_holes h
  where jsonb_array_length(coalesce(h.shots, '[]'::jsonb)) > 0
    and not exists (select 1 from public.round_shots s where s.round_id = h.round_id and s.hole_number = h.hole_number)
),
shots as (
  select l.round_id, l.hole_number, e.ordinality as position, e.value as shot
  from legacy_holes l cross join lateral jsonb_array_elements(l.shots) with ordinality as e(value, ordinality)
),
checks("순서", "항목", "값") as (
  select 1, '대상 홀 / 샷', (select count(*) from legacy_holes)::text || ' / ' || (select count(*) from shots)::text
  union all
  select 2, '샷 필드 구성별 개수',
    (select string_agg(keys || ': ' || c, ' | ' order by c desc) from (
      select (select string_agg(k, ',' order by k) from jsonb_object_keys(shot) k) as keys, count(*) as c
      from shots group by 1) s)
  union all
  select 3, '샷 위치(ballLie) 값별 개수',
    (select string_agg(coalesce(lie, '(없음)') || ': ' || c, ', ' order by c desc) from (
      select shot ->> 'ballLie' as lie, count(*) as c from shots group by 1) s)
  union all
  select 4, '숫자가 아니거나 0~2000m 밖인 거리',
    (select count(*) from shots, lateral (values (shot -> 'distanceToPinBefore'), (shot -> 'distanceToPinAfter'), (shot -> 'shotDistance')) v(d)
      where case when jsonb_typeof(d) = 'number' then (d)::numeric not between 0 and 2000 else true end)::text
  union all
  select 5, '샷 번호가 없거나 1~30 밖인 샷',
    (select count(*) from shots where case when jsonb_typeof(shot -> 'shotNumber') = 'number' then (shot -> 'shotNumber')::numeric not between 1 and 30 else true end)::text
  union all
  select 6, '샷 번호가 1부터 차례대로가 아닌 홀',
    (select count(*) from (select round_id, hole_number from shots
      group by 1, 2 having array_agg(case when jsonb_typeof(shot -> 'shotNumber') = 'number' then (shot -> 'shotNumber')::numeric end order by position)
        is distinct from array_agg(position::numeric order by position)) s)::text
  union all
  select 7, '벌타가 없거나 0~5 밖인 샷',
    (select count(*) from shots where case when jsonb_typeof(shot -> 'penalty') = 'number' then (shot -> 'penalty')::numeric not between 0 and 5 else true end)::text
  union all
  select 8, '클럽 이름이 비어 있는 샷',
    (select count(*) from shots where coalesce(trim(shot ->> 'club'), '') = '')::text
  union all
  select 9, '입력 방식(inputMethod) 값별 개수',
    (select string_agg(coalesce(m, '(없음)') || ': ' || c, ', ' order by c desc) from (
      select shot ->> 'inputMethod' as m, count(*) as c from shots group by 1) s)
  union all
  select 10, '마지막 샷이 홀아웃(남은 거리 0)이 아닌 홀',
    (select count(*) from legacy_holes l
      where (l.shots -> -1 ->> 'ballLie') is distinct from '홀아웃'
        or case when jsonb_typeof(l.shots -> -1 -> 'distanceToPinAfter') = 'number' then (l.shots -> -1 -> 'distanceToPinAfter')::numeric not between 0 and 0 else true end)::text
)
select "항목", "값" from checks order by "순서";
