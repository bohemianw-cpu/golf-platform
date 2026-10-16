-- 대시보드 시절의 관리자 확인 함수. 어떤 정책·함수·앱 코드도 쓰지 않고 관리자 계정도 없다.
-- 로그인한 사용자가 /rest/v1/rpc/is_admin 으로 직접 부를 수 있어(Supabase 보안 점검 경고) 지운다.
drop function if exists public.is_admin();
