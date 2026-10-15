-- 읽기 전용: 데이터 정리 전에 운영 DB 상태를 점검한다. 개인정보 내용은 읽지 않고 개수와 날짜만 센다.
-- Supabase SQL Editor에서 실행하고 결과 표(항목, 값)를 그대로 복사해 전달한다.
with legacy(oid) as (
  select pg_catalog.to_regclass(name)
  from (values ('public.lesson_inquiries'), ('public.user_clubs'), ('public.pros')) t(name)
),
checks("순서", "항목", "값") as (
  select 1, 'lesson_inquiries 행 수 / 최근 작성',
    (select count(*)::text || ' / ' || coalesce(max(created_at)::text, '없음') from public.lesson_inquiries)
  union all
  select 2, 'user_clubs 행 수 / 최근 작성',
    (select count(*)::text || ' / ' || coalesce(max(created_at)::text, '없음') from public.user_clubs)
  union all
  select 3, 'pros 행 수',
    case when pg_catalog.to_regclass('public.pros') is null then '테이블 없음'
      else (pg_catalog.xpath('/row/c/text()',
        pg_catalog.query_to_xml('select count(*) as c from public.pros', false, true, '')))[1]::text end
  union all
  select 4, 'pros를 참조하는 외래키',
    coalesce((select string_agg(con.conrelid::regclass::text || '.' || con.conname, ', ')
      from pg_catalog.pg_constraint con
      where con.contype = 'f' and con.confrelid = pg_catalog.to_regclass('public.pros')), '없음')
  union all
  select 5, '레거시 테이블을 쓰는 함수',
    coalesce((select string_agg(distinct n.nspname || '.' || p.proname, ', ')
      from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname not in ('pg_catalog', 'information_schema')
        and (p.prosrc ilike '%lesson_inquiries%' or p.prosrc ilike '%user_clubs%' or p.prosrc ~* '\mpros\M')), '없음')
  union all
  select 6, '레거시 테이블을 쓰는 뷰',
    coalesce((select string_agg(distinct v.oid::regclass::text, ', ')
      from pg_catalog.pg_depend d
      join pg_catalog.pg_rewrite rw on rw.oid = d.objid
      join pg_catalog.pg_class v on v.oid = rw.ev_class and v.relkind in ('v', 'm')
      where d.refobjid in (select oid from legacy where oid is not null)), '없음')
  union all
  select 7, 'user_id가 비어 있는 라운드', (select count(*)::text from public.rounds where user_id is null)
  union all
  select 8, '라운드 상태별 개수',
    (select string_agg(coalesce(status, '(빈 값)') || ': ' || c, ', ' order by c desc)
      from (select status, count(*) as c from public.rounds group by status) s)
  union all
  select 9, 'anon에게 쓰기 권한이 있는 테이블',
    coalesce((select string_agg(distinct table_name, ', ')
      from information_schema.role_table_grants
      where table_schema = 'public' and grantee = 'anon'
        and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')), '없음')
  union all
  select 10, 'authenticated에게 TRUNCATE 권한이 있는 테이블',
    coalesce((select string_agg(distinct table_name, ', ')
      from information_schema.role_table_grants
      where table_schema = 'public' and grantee = 'authenticated' and privilege_type = 'TRUNCATE'), '없음')
  union all
  select 11, 'auth.users 가입 트리거',
    (select string_agg(tgname, ', ' order by tgname) from pg_catalog.pg_trigger
      where tgrelid = pg_catalog.to_regclass('auth.users') and not tgisinternal)
)
select "항목", "값" from checks order by "순서";
