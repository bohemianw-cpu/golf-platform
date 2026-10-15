alter table public.rounds
  add column if not exists registered_at timestamptz;
update public.rounds
set registered_at = coalesce(completed_at, updated_at, created_at, clock_timestamp())
where status = 'completed' and registered_at is null;

create table if not exists public.sample_round_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create index if not exists sample_round_sessions_user_updated_idx
  on public.sample_round_sessions (user_id, updated_at desc);
alter table public.sample_round_sessions enable row level security;
revoke all on public.sample_round_sessions from public, anon;
grant select, insert, update on public.sample_round_sessions to authenticated;
drop policy if exists sample_sessions_read_own on public.sample_round_sessions;
create policy sample_sessions_read_own on public.sample_round_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists sample_sessions_insert_own on public.sample_round_sessions;
create policy sample_sessions_insert_own on public.sample_round_sessions
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists sample_sessions_update_own on public.sample_round_sessions;
create policy sample_sessions_update_own on public.sample_round_sessions
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function private.protect_registered_round()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.registered_at is not null then
    if (to_jsonb(new) - array['visibility', 'updated_at']) is distinct from
       (to_jsonb(old) - array['visibility', 'updated_at']) then
      raise exception 'This round has been registered and cannot be edited';
    end if;
  elsif tg_op = 'UPDATE' and old.registered_at is null and new.registered_at is not null then
    if new.status <> 'completed' then
      raise exception 'Only a completed round can be registered';
    end if;
    new.registered_at := clock_timestamp();
  end if;
  return new;
end;
$$;
drop trigger if exists protect_registered_round_before_update on public.rounds;
create trigger protect_registered_round_before_update
  before update on public.rounds for each row execute function private.protect_registered_round();

create or replace function private.protect_registered_round_children()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_round_id uuid;
  v_registered timestamptz;
begin
  v_round_id := case when tg_op = 'DELETE' then old.round_id else new.round_id end;
  select registered_at into v_registered from public.rounds where id = v_round_id;
  if v_registered is not null then
    raise exception 'This round has been registered and its shots cannot be edited';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
drop trigger if exists protect_registered_holes on public.round_holes;
create trigger protect_registered_holes before insert or update or delete on public.round_holes
  for each row execute function private.protect_registered_round_children();
drop trigger if exists protect_registered_shots on public.round_shots;
create trigger protect_registered_shots before insert or update or delete on public.round_shots
  for each row execute function private.protect_registered_round_children();

revoke all on function private.protect_registered_round(), private.protect_registered_round_children()
  from public, anon, authenticated;

drop policy if exists "본인 라운드만 삭제" on public.rounds;
create policy "본인 라운드만 삭제" on public.rounds
  for delete to authenticated using (
    (select auth.uid()) = user_id and registered_at is null
  );
