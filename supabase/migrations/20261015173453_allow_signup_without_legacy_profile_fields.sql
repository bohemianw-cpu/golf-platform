-- Signup triggers create profiles without these legacy fields. Their required
-- values are held in auth.users and user_signup_agreements instead.
alter table public.profiles
  alter column email drop not null,
  alter column terms_agreed_at drop not null,
  alter column privacy_agreed_at drop not null;

comment on column public.profiles.email is
  'Legacy profile field. New signup email is stored in auth.users.';
comment on column public.profiles.terms_agreed_at is
  'Legacy profile field. New signup terms are stored in user_signup_agreements.';
comment on column public.profiles.privacy_agreed_at is
  'Legacy profile field. New signup privacy notice is stored in user_signup_agreements.';
