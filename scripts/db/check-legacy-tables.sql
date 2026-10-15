-- 읽기 전용: 마이그레이션에 없는 예전 테이블의 보안 설정과 주인 없는 라운드를 점검한다.
-- 개인정보 내용은 읽지 않고 개수, 날짜, 설정만 확인한다.
with target(name) as (
  values ('posts'), ('group_buys'), ('round_scores'), ('pros'), ('lesson_inquiries'), ('user_clubs')
),
rel as (
  select t.name, c.oid, c.relrowsecurity
  from target t
  left join pg_catalog.pg_class c on c.oid = pg_catalog.to_regclass('public.' || t.name)
),
table_checks("순서", "항목", "값") as (
  select 10 + row_number() over (order by r.name), r.name || ' 상태',
    case when r.oid is null then '테이블 없음' else
      '행 ' || (pg_catalog.xpath('/row/c/text()', pg_catalog.query_to_xml(
        format('select count(*) as c from public.%I', r.name), false, true, '')))[1]::text
      || ' / RLS ' || case when r.relrowsecurity then '켜짐' else '꺼짐' end
      || ' / 정책 ' || coalesce((select string_agg(p.policyname || '(' || p.cmd || ', ' || array_to_string(p.roles, ' ') || ')', '; ')
        from pg_catalog.pg_policies p where p.schemaname = 'public' and p.tablename = r.name), '없음')
      || ' / anon 조회 권한 ' || case when exists (select 1 from information_schema.role_table_grants g
        where g.table_schema = 'public' and g.table_name = r.name and g.grantee = 'anon' and g.privilege_type = 'SELECT') then '있음' else '없음' end
      || ' / 참조하는 외래키 ' || coalesce((select string_agg(con.conrelid::regclass::text, ', ')
        from pg_catalog.pg_constraint con where con.contype = 'f' and con.confrelid = r.oid and con.conrelid <> r.oid), '없음')
    end
  from rel r
),
orphan_checks("순서", "항목", "값") as (
  select 30, '주인 없는 라운드: 개수 / 등록됨 / 생성 기간',
    (select count(*)::text || ' / ' || count(registered_at)::text || ' / '
      || coalesce(min(created_at)::date::text, '-') || ' ~ ' || coalesce(max(created_at)::date::text, '-')
      from public.rounds where user_id is null)
  union all
  select 31, '주인 없는 라운드: 상태별',
    (select string_agg(coalesce(status, '(빈 값)') || ': ' || c, ', ')
      from (select status, count(*) as c from public.rounds where user_id is null group by status) s)
  union all
  select 32, '주인 없는 라운드에 딸린 홀 / 샷',
    (select count(*)::text from public.round_holes h join public.rounds r on r.id = h.round_id where r.user_id is null)
      || ' / ' ||
    (select count(*)::text from public.round_shots s join public.rounds r on r.id = s.round_id where r.user_id is null)
  union all
  select 33, '상태가 진행중인 라운드 중 주인 있는 것',
    (select count(*)::text from public.rounds where status = '진행중' and user_id is not null)
)
select "항목", "값" from (select * from table_checks union all select * from orphan_checks) c order by "순서";
