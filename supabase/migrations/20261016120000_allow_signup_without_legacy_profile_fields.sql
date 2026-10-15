-- 가입 트리거(handle_new_user, sync_golf_profile_from_auth_user)는 아래 초기 컬럼을 채우지 않는다.
-- 값이 필수로 남아 있으면 auth.users 생성이 실패해 회원가입 전체가 막힌다.
-- 이메일은 auth.users에, 약관·개인정보 동의 이력은 user_signup_agreements에 저장하므로 필수 조건만 해제한다.
-- 기존 값은 그대로 둔다.
alter table public.profiles
  alter column email drop not null,
  alter column terms_agreed_at drop not null,
  alter column privacy_agreed_at drop not null;

comment on column public.profiles.email is
  '초기 스키마 컬럼. 신규 가입에서는 채우지 않으며 이메일은 auth.users를 기준으로 한다.';
comment on column public.profiles.terms_agreed_at is
  '초기 스키마 컬럼. 약관 동의 이력은 user_signup_agreements를 기준으로 한다.';
comment on column public.profiles.privacy_agreed_at is
  '초기 스키마 컬럼. 개인정보 안내 확인 이력은 user_signup_agreements를 기준으로 한다.';
