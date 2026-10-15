-- 2026-10-16 운영 DB 점검(scripts/db/check-data-cleanup.sql, check-legacy-tables.sql) 결과에 따른 정리.

-- 1. 앱에서 쓰지 않는 대시보드 시절 테이블을 삭제한다.
--    posts, group_buys, round_scores, pros는 모든 사용자에게 열린 정책이 걸려 있었고 테스트 데이터만 있었다.
--    lesson_inquiries, user_clubs는 비어 있었다. 다른 객체가 참조하면 실패하도록 cascade는 쓰지 않는다.
drop table if exists public.lesson_inquiries, public.pros, public.posts,
  public.group_buys, public.round_scores, public.user_clubs;

-- 2. 로그인 기능 이전(2026-10-06)에 만들어진 주인 없는 테스트 라운드를 지우고, 앞으로는 주인을 필수로 한다.
--    딸린 샷은 외래키로 함께 지워지며, 주인이 없어 감사 기록 트리거는 아무것도 남기지 않는다.
delete from public.rounds where user_id is null;
alter table public.rounds alter column user_id set not null;

-- 3. 앱이 쓰는 상태값과 기본값을 맞춘다. 앱은 항상 상태를 지정해 저장한다.
alter table public.rounds alter column status set default 'in_progress';

-- 4. round_shots_round_hole_shot_uidx(고유 인덱스)와 같은 컬럼의 중복 인덱스를 지운다.
drop index if exists public.round_shots_round_hole_idx;

-- 5. 가입 시 프로필은 sync_golf_profile_from_auth_user가 만들고 갱신하므로 중복 트리거를 지운다.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- 6. 쓰지 않는 테이블 권한을 회수한다. 조회는 각 테이블의 RLS 정책이 계속 결정한다.
--    로그인하지 않은 사용자는 어떤 테이블에도 쓸 수 없고, 로그인 사용자도 TRUNCATE 등은 쓸 수 없다.
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon;
revoke truncate, references, trigger
  on all tables in schema public from authenticated;
-- 골프장 카탈로그는 관리자 스크립트(서비스 키)로만 바꾼다.
revoke insert, update, delete
  on public.golf_courses, public.golf_course_routes, public.golf_course_holes, public.golf_course_hole_tees
  from authenticated;
