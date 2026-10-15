-- Client error reports: signed-in users can submit through the function only, query strings are dropped,
-- each user is limited to 20 reports per 10 minutes, and nobody can read the table through the API.
begin;
select set_config('request.jwt.claim.sub', (select user_id::text from public.rounds where user_id is not null limit 1), true);
set local role authenticated;

do $$
declare
  v_accepted integer := 0;
begin
  if auth.uid() is null then raise exception 'No account available for the error report test'; end if;
  if not public.report_client_error('error', 'Boom', 'Error: Boom', '/score?code=secret#top', null) then
    raise exception 'A signed-in user should be able to report an error';
  end if;
  if public.report_client_error('unknown', 'Boom', null, '/', null) then
    raise exception 'An unknown error kind should be refused';
  end if;

  begin
    perform 1 from public.client_error_reports;
    raise exception 'Signed-in users can read error reports';
  exception when insufficient_privilege then null;
  end;

  for i in 2..25 loop
    if public.report_client_error('error', 'Boom ' || i, null, '/my', null) then v_accepted := v_accepted + 1; end if;
  end loop;
  if v_accepted <> 19 then raise exception 'Expected 19 more accepted reports within ten minutes, got %', v_accepted; end if;
end;
$$;

reset role;
do $$
begin
  if exists (select 1 from public.client_error_reports where path like '%?%' or path like '%#%' or path like '%secret%') then
    raise exception 'Query strings were stored with an error report';
  end if;
  if not exists (select 1 from public.client_error_reports where path = '/score' and message = 'Boom') then
    raise exception 'The reported path was not stored as /score';
  end if;
end;
$$;

set local role anon;
do $$
begin
  perform public.report_client_error('error', 'Boom', null, '/', null);
  raise exception 'Anonymous visitors can report errors';
exception when insufficient_privilege then null;
end;
$$;

select 'client error reports are restricted' as result;
rollback;
