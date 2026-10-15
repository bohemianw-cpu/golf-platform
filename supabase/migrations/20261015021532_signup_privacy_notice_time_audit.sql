-- Accept the previous notice during a rolling deployment, while recording
-- the version each new member actually acknowledged.
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
    or v_privacy_version not in ('2026-10-15-v1', '2026-10-15-v2')
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
