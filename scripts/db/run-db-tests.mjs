// 빈 Postgres(PGlite)에 마이그레이션 전체를 적용하고 tests/db의 SQL 테스트를 실행한다.
// 운영 DB에 연결하지 않으며, 테스트마다 새 DB를 만든다. 사용법: npm run test:db
import { PGlite } from '@electric-sql/pglite'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const root = process.cwd()
const migrationDir = join(root, 'supabase/migrations')
const testDir = join(root, 'tests/db')

// Supabase가 기본으로 제공하는 역할, auth 스키마, pg_cron, public 스키마 기본 권한을 흉내 낸다.
const SUPABASE_STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb, created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
create schema cron;
create function cron.schedule(text, text, text) returns bigint language sql as $$ select 1::bigint $$;
`

// 실제 DB에 데이터가 있다고 가정하는 테스트를 위해 다른 사용자의 진행 중 라운드와 등록된 라운드를 만든다.
// 트리거가 막는 상태(등록된 라운드의 홀·샷)를 만들기 위해 잠시 트리거를 건너뛴다.
const SEED = `
set session_replication_role = replica;
insert into auth.users (id) values ('00000000-0000-4000-8000-0000000000bb');
set session_replication_role = origin;
insert into public.rounds (user_id, club_name, golf_club, course_name, play_mode, entry_mode, holes_count, status)
values ('00000000-0000-4000-8000-0000000000bb', '진행 CC', '진행 CC', 'OUT/IN', 'field', 'live', 18, 'in_progress');
set session_replication_role = replica;
insert into public.rounds (id, user_id, club_name, golf_club, course_name, play_mode, entry_mode, holes_count, status, registered_at, total_score, total_putts)
values ('00000000-0000-4000-8000-00000000f001', '00000000-0000-4000-8000-0000000000bb', '등록 CC', '등록 CC', 'OUT', 'field', 'live', 1, 'completed', now(), 3, 1);
insert into public.round_holes (round_id, hole_number, par, score, putts, gir, total_distance)
values ('00000000-0000-4000-8000-00000000f001', 1, 3, 3, 1, false, 120);
insert into public.round_shots (round_id, hole_number, shot_number, club, distance_to_pin_before, distance_to_pin_after, shot_distance, ball_lie, penalty, lie, remaining_dist)
values ('00000000-0000-4000-8000-00000000f001', 1, 1, '퍼터', 3, 0, 3, '홀아웃', 0, '홀아웃', 3);
set session_replication_role = origin;
`

const sqlFiles = async (dir) => (await readdir(dir)).filter((name) => name.endsWith('.sql')).sort()
// pg_cron 확장은 PGlite에 없으므로 만들지 않고, cron.schedule 흉내 함수로 대신한다.
const readMigration = async (name) =>
  (await readFile(join(migrationDir, name), 'utf8')).replace(/create extension if not exists pg_cron[^;]*;/gi, '')

const migrations = await sqlFiles(migrationDir)
const migrationSql = await Promise.all(migrations.map(readMigration))

async function migratedDatabase() {
  const db = new PGlite()
  await db.exec(SUPABASE_STUB)
  for (const [index, sql] of migrationSql.entries()) {
    try {
      await db.exec(sql)
    } catch (error) {
      throw new Error(`마이그레이션 적용 실패 ${migrations[index]}: ${error.message}`)
    }
  }
  return db
}

let failed = 0
try {
  await (await migratedDatabase()).close()
  console.log(`통과 마이그레이션 ${migrations.length}개를 빈 DB에 순서대로 적용`)
} catch (error) {
  console.error(`실패 ${error.message}`)
  process.exit(1)
}

for (const name of await sqlFiles(testDir)) {
  const db = await migratedDatabase()
  try {
    await db.exec(SEED)
    await db.exec(await readFile(join(testDir, name), 'utf8'))
    console.log(`통과 ${name}`)
  } catch (error) {
    failed += 1
    console.error(`실패 ${name}: ${error.message}`)
  } finally {
    await db.close()
  }
}

if (failed > 0) {
  console.error(`DB 테스트 ${failed}개 실패`)
  process.exit(1)
}
