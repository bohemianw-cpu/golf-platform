-- Required signup acknowledgements and independent optional AI analysis consent.
create table public.user_signup_agreements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  terms_version text not null,
  privacy_notice_version text not null,
  age_over_14_confirmed boolean not null check (age_over_14_confirmed),
  accepted_at timestamptz not null default now()
);
alter table public.user_signup_agreements enable row level security;
create policy "read own signup agreement" on public.user_signup_agreements
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.user_signup_agreements from public, anon, authenticated;
grant select on public.user_signup_agreements to authenticated;

alter table public.user_data_preferences
  add column allow_ai_practice_analysis boolean not null default false;

alter table public.user_data_consent_events
  drop constraint if exists user_data_consent_events_consent_kind_check;
alter table public.user_data_consent_events
  add constraint user_data_consent_events_consent_kind_check
  check (consent_kind in ('anonymous_aggregate', 'friend_sharing', 'ai_practice_analysis'));

create or replace function public.capture_signup_data_preferences()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_aggregate boolean := coalesce(new.raw_user_meta_data ->> 'allow_anonymous_aggregate', 'false') = 'true';
  v_friends boolean := coalesce(new.raw_user_meta_data ->> 'allow_friend_sharing', 'false') = 'true';
  v_ai boolean := coalesce(new.raw_user_meta_data ->> 'allow_ai_practice_analysis', 'false') = 'true';
begin
  if new.raw_user_meta_data ->> 'signup_terms_version' <> '2026-10-15-v1'
    or new.raw_user_meta_data ->> 'privacy_notice_version' <> '2026-10-15-v1'
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
  values (new.id, '2026-10-15-v1', '2026-10-15-v1', true);
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

create or replace function public.set_my_data_sharing_preference(
  p_preference text, p_enabled boolean, p_policy_version text default '2026-10-14-v1'
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := (select auth.uid());
  v_expected_version text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_preference not in ('anonymous_aggregate', 'friend_sharing', 'ai_practice_analysis') or p_preference is null then
    raise exception 'Unsupported data preference';
  end if;
  if p_enabled is null then raise exception 'Preference value is required'; end if;
  v_expected_version := case when p_preference = 'ai_practice_analysis' then '2026-10-15-v1' else '2026-10-14-v1' end;
  if p_policy_version is distinct from v_expected_version then raise exception 'Consent text version is no longer current'; end if;
  insert into public.user_data_preferences (user_id) values (v_user_id) on conflict (user_id) do nothing;
  if p_preference = 'anonymous_aggregate' then
    update public.user_data_preferences set allow_anonymous_aggregate = p_enabled, updated_at = now() where user_id = v_user_id;
    if not p_enabled then update public.rounds set visibility = 'private' where user_id = v_user_id and visibility = 'aggregate'; end if;
  elsif p_preference = 'friend_sharing' then
    update public.user_data_preferences set allow_friend_sharing = p_enabled, updated_at = now() where user_id = v_user_id;
    if not p_enabled then update public.rounds set visibility = 'private' where user_id = v_user_id and visibility = 'friends'; end if;
  else
    update public.user_data_preferences set allow_ai_practice_analysis = p_enabled, updated_at = now() where user_id = v_user_id;
  end if;
  insert into public.user_data_consent_events (user_id, consent_kind, granted, policy_version, source)
  values (v_user_id, p_preference, p_enabled, v_expected_version, 'settings');
end;
$$;
revoke all on function public.set_my_data_sharing_preference(text, boolean, text) from public, anon;
grant execute on function public.set_my_data_sharing_preference(text, boolean, text) to authenticated;

-- The account and all dependent data are removed on withdrawal. Keep only a
-- minimal processing record for six months, without email or shot history.
create table public.account_withdrawal_audit (
  user_id uuid primary key,
  withdrawn_at timestamptz not null default now(),
  purge_at timestamptz not null default (now() + interval '6 months')
);
alter table public.account_withdrawal_audit enable row level security;
revoke all on public.account_withdrawal_audit from public, anon, authenticated;

create or replace function public.withdraw_my_account()
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  insert into public.account_withdrawal_audit (user_id) values (v_user_id);
  delete from auth.users where id = v_user_id;
  if not found then raise exception 'Account was not deleted'; end if;
end;
$$;
revoke all on function public.withdraw_my_account() from public, anon;
grant execute on function public.withdraw_my_account() to authenticated;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
  'purge_golf_withdrawal_audit_daily',
  '17 3 * * *',
  $$delete from public.account_withdrawal_audit where purge_at <= now()$$
);
