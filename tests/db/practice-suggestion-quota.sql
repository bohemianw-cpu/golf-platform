-- AI practice suggestion quota: three requests per ten minutes, a failed request can be released,
-- and releases are capped at three per day. Uses any existing account; everything is rolled back.
begin;
select set_config('request.jwt.claim.sub', (select user_id::text from public.rounds where user_id is not null limit 1), true);
set local role authenticated;

do $$
begin
  if auth.uid() is null then raise exception 'No account available for the quota test'; end if;
  if not (public.reserve_practice_suggestion_request() and public.reserve_practice_suggestion_request()
          and public.reserve_practice_suggestion_request()) then
    raise exception 'The first three requests should be allowed';
  end if;
  if public.reserve_practice_suggestion_request() then
    raise exception 'A fourth request within ten minutes should be refused';
  end if;

  if not public.release_practice_suggestion_request() then
    raise exception 'A failed request should be released';
  end if;
  if not public.reserve_practice_suggestion_request() then
    raise exception 'A released request should free one slot';
  end if;

  if not (public.release_practice_suggestion_request() and public.release_practice_suggestion_request()) then
    raise exception 'Up to three releases per day should be allowed';
  end if;
  if public.release_practice_suggestion_request() then
    raise exception 'A fourth release within a day should be refused';
  end if;
end;
$$;

select 'practice suggestion quota holds' as result;
rollback;
