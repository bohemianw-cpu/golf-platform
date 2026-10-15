-- AI 연습 제안은 OpenAI 호출 전에 요청 횟수를 먼저 예약한다(10분에 3회, 하루 12회).
-- OpenAI 오류로 제안을 받지 못했을 때도 횟수가 줄지 않도록, 방금 예약한 한 번을 되돌릴 수 있게 한다.
-- 이 함수는 로그인한 사용자가 직접 호출할 수도 있으므로 악용 범위를 제한한다.
--  - 2분 안에 예약한 요청만 되돌린다.
--  - 되돌리기는 하루 3번까지다. 악용해도 하루 최대 3번만 더 쓸 수 있다.
-- 되돌린 요청은 지우지 않고 released_at만 기록해 비용·오남용 확인에 남긴다.
alter table public.practice_suggestion_requests add column if not exists released_at timestamptz;

create or replace function public.reserve_practice_suggestion_request()
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := (select auth.uid());
  v_now timestamptz := clock_timestamp();
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  -- Serialize concurrent requests for the same user before checking the quota.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_user_id::text));
  if (select count(*) from public.practice_suggestion_requests
      where user_id = v_user_id and released_at is null and requested_at > v_now - interval '10 minutes') >= 3
    or (select count(*) from public.practice_suggestion_requests
      where user_id = v_user_id and released_at is null and requested_at > v_now - interval '1 day') >= 12 then
    return false;
  end if;
  insert into public.practice_suggestion_requests (user_id, requested_at) values (v_user_id, v_now);
  return true;
end;
$$;

create or replace function public.release_practice_suggestion_request()
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := (select auth.uid());
  v_now timestamptz := clock_timestamp();
  v_request_id bigint;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_user_id::text));
  if (select count(*) from public.practice_suggestion_requests
      where user_id = v_user_id and released_at > v_now - interval '1 day') >= 3 then
    return false;
  end if;
  select id into v_request_id
  from public.practice_suggestion_requests
  where user_id = v_user_id and released_at is null and requested_at > v_now - interval '2 minutes'
  order by requested_at desc, id desc
  limit 1;
  if v_request_id is null then return false; end if;
  update public.practice_suggestion_requests set released_at = v_now where id = v_request_id;
  return true;
end;
$$;
revoke all on function public.reserve_practice_suggestion_request() from public, anon;
grant execute on function public.reserve_practice_suggestion_request() to authenticated;
revoke all on function public.release_practice_suggestion_request() from public, anon;
grant execute on function public.release_practice_suggestion_request() to authenticated;
