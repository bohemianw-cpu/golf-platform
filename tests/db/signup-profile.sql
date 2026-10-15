-- Signup creates the auth user, profile, agreement and data preference rows. All probes run in a transaction.
begin;

do $$
declare
  v_user_id uuid := '00000000-0000-4000-8000-0000000000a1';
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_user_id, 'signup-test@example.invalid', jsonb_build_object(
    'nickname', '가입테스트',
    'handicap_index', '18.5',
    'signup_terms_version', '2026-10-15-v1',
    'privacy_notice_version', '2026-10-15-v3',
    'age_over_14_confirmed', 'true',
    'allow_anonymous_aggregate', 'false',
    'allow_friend_sharing', 'false',
    'allow_ai_practice_analysis', 'false'
  ));

  if not exists (select 1 from public.profiles where id = v_user_id and nickname = '가입테스트' and skill_group = 'amateur') then
    raise exception 'Signup did not create the golf profile';
  end if;
  if not exists (select 1 from public.user_signup_agreements where user_id = v_user_id) then
    raise exception 'Signup did not record the required agreements';
  end if;
  if not exists (select 1 from public.user_data_preferences where user_id = v_user_id and not allow_ai_practice_analysis) then
    raise exception 'Signup did not record the default data preferences';
  end if;

  begin
    insert into auth.users (id, email, raw_user_meta_data)
    values ('00000000-0000-4000-8000-0000000000a2', 'missing-terms@example.invalid', '{"nickname": "약관누락"}'::jsonb);
    raise exception 'Signup succeeded without the required confirmations';
  exception
    when raise_exception then
      if sqlerrm <> 'Required signup confirmations are missing' then raise; end if;
  end;
end;
$$;

select 'signup creates profile and agreement records' as result;
rollback;
