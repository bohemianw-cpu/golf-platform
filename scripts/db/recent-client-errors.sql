-- 읽기 전용: 최근 7일 동안 앱 화면에서 보고된 오류를 같은 오류끼리 묶어 많이 난 순서로 보여 준다.
-- Supabase SQL Editor에서 실행한다. 사용자 계정 ID는 보여 주지 않고 영향을 받은 사람 수만 센다.
select
  kind as "종류",
  path as "화면",
  message as "오류 메시지",
  count(*) as "횟수",
  count(distinct user_id) as "영향 받은 사람",
  to_char(min(reported_at) at time zone 'Asia/Seoul', 'MM-DD HH24:MI') as "처음",
  to_char(max(reported_at) at time zone 'Asia/Seoul', 'MM-DD HH24:MI') as "마지막",
  (array_agg(stack order by reported_at desc) filter (where stack is not null))[1] as "최근 코드 위치",
  (array_agg(digest order by reported_at desc) filter (where digest is not null))[1] as "서버 오류 번호"
from public.client_error_reports
where reported_at > now() - interval '7 days'
group by kind, path, message
order by count(*) desc, max(reported_at) desc
limit 50;
