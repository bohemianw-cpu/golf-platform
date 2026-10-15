-- 앱 화면에서 난 오류를 외부 서비스 없이 우리 DB에 모은다. 운영자는 SQL Editor에서만 확인한다
-- (scripts/db/recent-client-errors.sql). 앱은 report_client_error 함수로만 기록을 넣고 읽을 수 없다.
-- 개인정보를 줄이기 위해 경로의 쿼리·해시를 버리고 길이를 자르며, 30일 뒤 자동 삭제한다.
create table public.client_error_reports (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  reported_at timestamptz not null default now(),
  kind text not null check (kind in ('error', 'unhandledrejection', 'render')),
  message text not null check (char_length(message) <= 500),
  stack text check (char_length(stack) <= 2000),
  path text not null check (char_length(path) <= 200),
  digest text check (char_length(digest) <= 100)
);
create index client_error_reports_time_idx on public.client_error_reports (reported_at desc);
create index client_error_reports_user_time_idx on public.client_error_reports (user_id, reported_at desc);
alter table public.client_error_reports enable row level security;
revoke all on public.client_error_reports from public, anon, authenticated;

-- 로그인한 사용자만 보낼 수 있고, 한 사람당 10분에 20건까지만 받는다. 받지 않은 보고는 false를 돌려준다.
create function public.report_client_error(
  p_kind text, p_message text, p_stack text, p_path text, p_digest text default null
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := (select auth.uid());
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_path text;
begin
  if v_user_id is null or p_kind is null or p_kind not in ('error', 'unhandledrejection', 'render') then
    return false;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('client_error:' || v_user_id::text));
  if (select count(*) from public.client_error_reports
      where user_id = v_user_id and reported_at > v_now - interval '10 minutes') >= 20 then
    return false;
  end if;
  -- 로그인 메일 링크의 code 같은 값이 남지 않도록 경로만 저장한다.
  v_path := pg_catalog.split_part(pg_catalog.split_part(coalesce(p_path, ''), '?', 1), '#', 1);
  insert into public.client_error_reports (user_id, reported_at, kind, message, stack, path, digest)
  values (
    v_user_id, v_now, p_kind,
    pg_catalog.left(coalesce(nullif(pg_catalog.btrim(p_message), ''), '(빈 메시지)'), 500),
    pg_catalog.left(nullif(p_stack, ''), 2000),
    pg_catalog.left(coalesce(nullif(v_path, ''), '/'), 200),
    pg_catalog.left(nullif(p_digest, ''), 100)
  );
  return true;
end;
$$;
revoke all on function public.report_client_error(text, text, text, text, text) from public, anon;
grant execute on function public.report_client_error(text, text, text, text, text) to authenticated;

select cron.schedule(
  'purge_golf_client_error_reports_daily',
  '23 4 * * *',
  $$delete from public.client_error_reports where reported_at < now() - interval '30 days'$$
);
