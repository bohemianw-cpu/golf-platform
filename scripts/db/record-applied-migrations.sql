-- SQL Editor에 붙여넣어 적용한 마이그레이션은 Supabase 적용 기록(supabase_migrations.schema_migrations)에
-- 남지 않는다. 결과물이 운영 DB에 실제로 있는 마이그레이션만 골라 "적용됨"으로 기록한다.
-- `supabase migration repair --status applied <버전>`과 같은 일을 한다. 이미 기록된 것은 건드리지 않는다.
-- 데이터는 바꾸지 않고 적용 기록 테이블에만 행을 추가한다. 마지막에 기록한 것과 건너뛴 것을 보여 준다.
with candidates(version, name, applied) as (
  values
    -- 기준 스키마: 대시보드 시절 테이블이 있으면 이미 반영된 상태다.
    ('20261011000000', 'legacy_dashboard_baseline',
      pg_catalog.to_regclass('public.rounds') is not null and pg_catalog.to_regclass('public.round_holes') is not null),
    -- 예전 테이블 삭제와 권한 회수: 지운 테이블과 중복 인덱스가 없어야 한다.
    ('20261016130000', 'clean_up_legacy_tables_and_privileges',
      pg_catalog.to_regclass('public.posts') is null and pg_catalog.to_regclass('public.pros') is null
        and pg_catalog.to_regclass('public.round_shots_round_hole_idx') is null),
    -- 예전 샷 옮기기: 다음 마이그레이션이 사본 컬럼을 지웠다면 옮기기는 이미 끝난 것이다.
    ('20261016140000', 'backfill_round_shots_from_hole_copies',
      not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'round_holes' and column_name = 'shots')),
    ('20261016150000', 'drop_round_hole_shot_copies',
      not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'round_holes' and column_name = 'shots')),
    ('20261016160000', 'release_failed_practice_suggestion_requests',
      exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'practice_suggestion_requests' and column_name = 'released_at')),
    ('20261016170000', 'client_error_reports',
      pg_catalog.to_regclass('public.client_error_reports') is not null),
    -- 개인정보 안내 v4: 가입 처리 함수가 새 버전을 받아야 한다.
    ('20261016180000', 'accept_privacy_notice_v4',
      exists (select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'capture_signup_data_preferences' and p.prosrc like '%2026-10-16-v4%'))
),
recorded as (
  insert into supabase_migrations.schema_migrations (version, name)
  select c.version, c.name from candidates c
  where c.applied
    and not exists (select 1 from supabase_migrations.schema_migrations m where m.version = c.version)
  returning version
)
select c.version as "마이그레이션", c.name as "이름",
  case
    when c.version in (select version from recorded) then '이번에 적용됨으로 기록'
    when exists (select 1 from supabase_migrations.schema_migrations m where m.version = c.version) then '이미 기록돼 있음'
    else '운영 DB에 결과물이 없어 건너뜀 (아직 적용 안 함)'
  end as "결과"
from candidates c
order by c.version;
