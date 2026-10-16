-- MY 탭 요약(전체·완료 라운드 수, 평균·베스트 스코어, 레벨과 트로피에 인정되는 라운드)을 서버에서 계산한다.
-- 예전에는 모든 라운드와 기록 확인 결과를 내려받아 브라우저에서 셌다. 이제 목록은 나눠 불러오고, 요약은 이 함수로 받는다.
-- security invoker라서 행 보안 규칙에 따라 로그인한 사용자 본인의 라운드만 센다.

create function public.get_my_round_overview()
returns table (
  total_rounds integer,
  completed_rounds integer,
  average_score double precision,
  best_score integer,
  achievement_round_ids uuid[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  with mine as (
    select r.id, r.status, r.total_score, r.registered_at
    from public.rounds r
    where r.user_id = (select auth.uid())
  ),
  completed as (
    select * from mine where status = 'completed' and total_score is not null
  )
  select
    (select count(*) from mine)::integer,
    (select count(*) from completed)::integer,
    (select avg(total_score)::double precision from completed),
    (select min(total_score) from completed)::integer,
    -- 등록 후 소요시간 확인을 통과한 완료 라운드만 레벨과 트로피에 인정한다.
    coalesce((
      select array_agg(c.id order by c.id)
      from completed c
      join public.round_integrity i on i.round_id = c.id
      where c.registered_at is not null and i.status = 'time_plausible'
    ), '{}');
$$;

revoke all on function public.get_my_round_overview() from public, anon;
grant execute on function public.get_my_round_overview() to authenticated;
