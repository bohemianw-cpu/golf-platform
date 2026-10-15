-- 읽기 전용: 운영 DB에 "적용됨"으로 기록된 마이그레이션 목록을 보여 준다.
-- Supabase CLI나 MCP로 적용한 것만 기록되고, SQL Editor에 붙여넣어 실행한 것은 기록되지 않는다.
select
  case when pg_catalog.to_regclass('supabase_migrations.schema_migrations') is null
    then '기록 테이블 없음'
    else (pg_catalog.xpath('/row/v/text()', pg_catalog.query_to_xml(
      'select coalesce(string_agg(version, '', '' order by version), ''(비어 있음)'') as v from supabase_migrations.schema_migrations',
      false, true, '')))[1]::text
  end as "적용 기록에 있는 마이그레이션";
