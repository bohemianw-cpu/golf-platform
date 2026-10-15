-- Keep only request timestamps for abuse and cost control. Never store shot payloads here.
create table public.practice_suggestion_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now()
);
create index practice_suggestion_requests_user_time_idx
  on public.practice_suggestion_requests (user_id, requested_at desc);
alter table public.practice_suggestion_requests enable row level security;
revoke all on public.practice_suggestion_requests from public, anon, authenticated;

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
      where user_id = v_user_id and requested_at > v_now - interval '10 minutes') >= 3
    or (select count(*) from public.practice_suggestion_requests
      where user_id = v_user_id and requested_at > v_now - interval '1 day') >= 12 then
    return false;
  end if;
  insert into public.practice_suggestion_requests (user_id, requested_at) values (v_user_id, v_now);
  return true;
end;
$$;
revoke all on function public.reserve_practice_suggestion_request() from public, anon;
grant execute on function public.reserve_practice_suggestion_request() to authenticated;

select cron.schedule(
  'purge_golf_practice_suggestion_requests_daily',
  '53 3 * * *',
  $$delete from public.practice_suggestion_requests where requested_at < now() - interval '32 days'$$
);

-- Accept the revised privacy notice while keeping earlier accepted versions valid.
create or replace function public.capture_signup_data_preferences()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_aggregate boolean := coalesce(new.raw_user_meta_data ->> 'allow_anonymous_aggregate', 'false') = 'true';
  v_friends boolean := coalesce(new.raw_user_meta_data ->> 'allow_friend_sharing', 'false') = 'true';
  v_ai boolean := coalesce(new.raw_user_meta_data ->> 'allow_ai_practice_analysis', 'false') = 'true';
  v_privacy_version text := new.raw_user_meta_data ->> 'privacy_notice_version';
begin
  if new.raw_user_meta_data ->> 'signup_terms_version' <> '2026-10-15-v1'
    or v_privacy_version is null
    or v_privacy_version not in ('2026-10-15-v1', '2026-10-15-v2', '2026-10-15-v3')
    or new.raw_user_meta_data ->> 'age_over_14_confirmed' is distinct from 'true'
  then
    raise exception 'Required signup confirmations are missing';
  end if;
  if (v_aggregate or v_friends) and new.raw_user_meta_data ->> 'data_consent_version' is distinct from '2026-10-14-v1' then
    raise exception 'Sharing consent version is missing';
  end if;
  if v_ai and new.raw_user_meta_data ->> 'ai_consent_version' is distinct from '2026-10-15-v1' then
    raise exception 'AI analysis consent version is missing';
  end if;
  insert into public.user_signup_agreements (user_id, terms_version, privacy_notice_version, age_over_14_confirmed)
  values (new.id, '2026-10-15-v1', v_privacy_version, true);
  insert into public.user_data_preferences
    (user_id, allow_anonymous_aggregate, allow_friend_sharing, allow_ai_practice_analysis)
  values (new.id, v_aggregate, v_friends, v_ai)
  on conflict (user_id) do nothing;
  insert into public.user_data_consent_events (user_id, consent_kind, granted, policy_version, source)
  values (new.id, 'anonymous_aggregate', v_aggregate, '2026-10-14-v1', 'signup'),
    (new.id, 'friend_sharing', v_friends, '2026-10-14-v1', 'signup'),
    (new.id, 'ai_practice_analysis', v_ai, '2026-10-15-v1', 'signup');
  return new;
end;
$$;
revoke all on function public.capture_signup_data_preferences() from public, anon, authenticated;
