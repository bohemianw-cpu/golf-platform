-- MY 탭 트로피 판정에 쓰는 집계를 서버에서 계산한다.
-- 예전에는 인정 라운드의 홀·샷 기록을 모두 내려받아 브라우저에서 셌다. 이제 결과 한 줄만 돌려준다.
-- security invoker라서 행 보안 규칙이 그대로 적용되고, 남의 라운드 id를 넘겨도 집계에 들어가지 않는다.

create function public.get_my_trophy_stats(p_round_ids uuid[])
returns table (
  birdies integer,
  eagles integer,
  fairway_holes integer,
  fairway_hits integer,
  gir_holes integer,
  gir_hits integer,
  best_full_round_score integer,
  has_even_par_round boolean,
  has_under_par_round boolean,
  has_putt_rhythm_round boolean,
  has_long_drive boolean,
  has_clean_round boolean,
  has_par_or_better_nine boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with holes as (
    select h.round_id, h.par, h.score, h.putts, h.fairway_hit, h.gir
    from public.round_holes h
    where h.round_id = any(p_round_ids)
  ),
  shots as (
    select s.round_id, s.club, s.shot_distance, s.penalty
    from public.round_shots s
    where s.round_id = any(p_round_ids)
  ),
  per_round as (
    select round_id,
      count(*) as hole_count,
      sum(score) as total_score,
      sum(par) as total_par,
      sum(putts) as total_putts,
      count(*) filter (where score <= par) as par_or_better
    from holes
    group by round_id
  ),
  shot_rounds as (
    select round_id, bool_and(penalty = 0) as clean
    from shots
    group by round_id
  )
  select
    (select count(*) from holes where score <= par - 1)::integer,
    (select count(*) from holes where score <= par - 2)::integer,
    (select count(*) from holes where par >= 4 and fairway_hit is not null)::integer,
    (select count(*) from holes where par >= 4 and fairway_hit)::integer,
    (select count(*) from holes where gir is not null)::integer,
    (select count(*) from holes where gir)::integer,
    (select min(total_score) from per_round where hole_count >= 18)::integer,
    exists (select 1 from per_round where hole_count >= 18 and total_score = total_par),
    exists (select 1 from per_round where hole_count >= 18 and total_score < total_par),
    -- 홀당 평균 퍼트 1.8 이하를 정수로 비교한다(합계 × 10 ≤ 18 × 홀 수).
    exists (select 1 from per_round where hole_count >= 9 and total_putts * 10 <= 18 * hole_count),
    exists (select 1 from shots where club ~* '드라이버|driver' and shot_distance >= 250),
    exists (select 1 from shot_rounds where clean),
    exists (select 1 from per_round where par_or_better >= 9);
$$;

revoke all on function public.get_my_trophy_stats(uuid[]) from public, anon;
grant execute on function public.get_my_trophy_stats(uuid[]) to authenticated;
