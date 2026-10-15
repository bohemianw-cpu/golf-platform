-- Server-observed timing is evidence about entry, not proof that golf was played.
alter table public.rounds
  add column if not exists entry_mode text not null default 'live'
    check (entry_mode in ('live', 'backfill')),
  add column if not exists completed_at timestamptz;
alter table public.round_shots
  add column if not exists input_method text not null default 'manual'
    check (input_method in ('manual', 'quick_putt'));

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.round_integrity (
  round_id uuid primary key references public.rounds(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  completed_at timestamptz,
  first_input_at timestamptz,
  last_input_at timestamptz,
  input_event_count integer not null default 0,
  correction_event_count integer not null default 0,
  observed_holes integer,
  minimum_seconds integer,
  observed_seconds integer,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'self_reported', 'time_plausible', 'review_required')),
  reason_codes text[] not null default '{}',
  assessed_at timestamptz
);
create index round_integrity_user_idx on public.round_integrity (user_id, started_at desc);

create table public.round_input_events (
  id bigint generated always as identity primary key,
  round_id uuid not null references public.rounds(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('shot_added', 'shot_corrected', 'shot_removed', 'hole_corrected')),
  hole_number integer,
  shot_number integer,
  input_method text,
  received_at timestamptz not null default clock_timestamp()
);
create index round_input_events_round_time_idx on public.round_input_events (round_id, received_at);

alter table public.round_integrity enable row level security;
alter table public.round_input_events enable row level security;
revoke all on public.round_integrity, public.round_input_events from public, anon, authenticated;
grant select on public.round_integrity, public.round_input_events to authenticated;
create policy "read own round integrity" on public.round_integrity
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "read own round input events" on public.round_input_events
  for select to authenticated using ((select auth.uid()) = user_id);

-- Existing rounds have no trustworthy input audit. Keep them clearly self-reported.
insert into public.round_integrity
  (round_id, user_id, started_at, completed_at, status, reason_codes)
select id, user_id, coalesce(started_at, created_at), completed_at,
  case when status = 'completed' then 'self_reported' else 'in_progress' end,
  case when status = 'completed' then array['legacy_without_audit']::text[] else '{}'::text[] end
from public.rounds where user_id is not null;

create function private.lock_round_clock()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := clock_timestamp();
    new.started_at := new.created_at;
    if new.status = 'completed' then new.completed_at := new.created_at; end if;
  else
    new.created_at := old.created_at;
    new.started_at := coalesce(old.started_at, old.created_at);
    new.completed_at := old.completed_at;
    new.entry_mode := old.entry_mode;
    new.play_mode := old.play_mode;
    new.holes_count := old.holes_count;
    if old.status is distinct from 'completed' and new.status = 'completed' then
      new.completed_at := clock_timestamp();
    end if;
  end if;
  return new;
end;
$$;
create trigger lock_round_clock_before_write
  before insert or update on public.rounds for each row execute function private.lock_round_clock();

create function private.lock_shot_clock()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := clock_timestamp();
    new.recorded_at := new.created_at;
  else
    if new.round_id is distinct from old.round_id then
      raise exception 'A shot cannot be moved to another round';
    end if;
    new.created_at := old.created_at;
    new.recorded_at := old.recorded_at;
    new.input_method := old.input_method;
  end if;
  return new;
end;
$$;
create trigger lock_shot_clock_before_write
  before insert or update on public.round_shots for each row execute function private.lock_shot_clock();

create function private.assess_round_time(p_round_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_round public.rounds%rowtype;
  v_holes integer;
  v_observed integer;
  v_minimum integer;
  v_shots integer;
  v_status text;
  v_reasons text[] := '{}';
begin
  select * into v_round from public.rounds where id = p_round_id;
  if not found or v_round.user_id is null or v_round.status <> 'completed' then return; end if;
  select count(*) into v_holes from public.round_holes where round_id = p_round_id;
  select count(*) into v_shots from public.round_shots where round_id = p_round_id;
  v_observed := greatest(0, floor(extract(epoch from (v_round.completed_at - v_round.started_at)))::integer);
  -- Deliberately very low floors: field 6m40s/hole, screen 1m20s/hole.
  v_minimum := v_round.holes_count * case when v_round.play_mode = 'screen' then 80 else 400 end;
  if v_round.entry_mode = 'backfill' then
    v_status := 'self_reported';
    v_reasons := array_append(v_reasons, 'backfilled');
  elsif v_holes <> v_round.holes_count or v_shots = 0 then
    v_status := 'self_reported';
    v_reasons := array_append(v_reasons, 'incomplete_event_evidence');
  elsif v_observed < v_minimum then
    v_status := 'review_required';
    v_reasons := array_append(v_reasons, 'below_minimum_duration');
  else
    v_status := 'time_plausible';
  end if;
  update public.round_integrity set
    completed_at = v_round.completed_at,
    observed_holes = v_holes,
    minimum_seconds = v_minimum,
    observed_seconds = v_observed,
    status = v_status,
    reason_codes = v_reasons,
    assessed_at = clock_timestamp()
  where round_id = p_round_id;
end;
$$;

create function private.capture_round_integrity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.user_id is not null then
      insert into public.round_integrity (round_id, user_id, started_at)
      values (new.id, new.user_id, new.started_at);
      if new.status = 'completed' then perform private.assess_round_time(new.id); end if;
    end if;
  elsif new.status = 'completed' and old.status is distinct from 'completed' then
    perform private.assess_round_time(new.id);
  elsif old.status = 'completed' and
    (new.total_score is distinct from old.total_score or new.total_putts is distinct from old.total_putts) then
    update public.round_integrity set status = 'review_required',
      reason_codes = array_append(reason_codes, 'post_completion_correction'),
      assessed_at = clock_timestamp()
    where round_id = new.id;
  end if;
  return null;
end;
$$;
create trigger capture_round_integrity_after_write
  after insert or update on public.rounds for each row execute function private.capture_round_integrity();

create function private.capture_shot_input()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_shot public.round_shots%rowtype;
  v_user_id uuid;
  v_status text;
  v_event text;
  v_now timestamptz := clock_timestamp();
begin
  if tg_op = 'UPDATE' and
    (to_jsonb(new) - 'recorded_at' - 'created_at') = (to_jsonb(old) - 'recorded_at' - 'created_at') then
    return null;
  end if;
  if tg_op = 'DELETE' then v_shot := old; v_event := 'shot_removed';
  elsif tg_op = 'UPDATE' then v_shot := new; v_event := 'shot_corrected';
  else v_shot := new; v_event := 'shot_added'; end if;
  select user_id, status into v_user_id, v_status from public.rounds where id = v_shot.round_id;
  if v_user_id is null then return null; end if;
  insert into public.round_input_events
    (round_id, user_id, event_type, hole_number, shot_number, input_method, received_at)
  values (v_shot.round_id, v_user_id, v_event, v_shot.hole_number, v_shot.shot_number, v_shot.input_method, v_now);
  update public.round_integrity set
    first_input_at = coalesce(first_input_at, v_now),
    last_input_at = v_now,
    input_event_count = input_event_count + 1,
    correction_event_count = correction_event_count + case when v_event = 'shot_added' then 0 else 1 end,
    status = case when v_status = 'completed' then 'review_required' else status end,
    reason_codes = case when v_status = 'completed' then array_append(reason_codes, 'post_completion_correction') else reason_codes end
  where round_id = v_shot.round_id;
  return null;
end;
$$;
create trigger capture_shot_input_after_write
  after insert or update or delete on public.round_shots
  for each row execute function private.capture_shot_input();

create function private.capture_hole_correction()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_round_id uuid;
  v_hole integer;
  v_user_id uuid;
  v_status text;
begin
  if tg_op = 'UPDATE' and to_jsonb(new) = to_jsonb(old) then return null; end if;
  if tg_op = 'INSERT' then return null; end if;
  if tg_op = 'DELETE' then v_round_id := old.round_id; v_hole := old.hole_number;
  else v_round_id := new.round_id; v_hole := new.hole_number; end if;
  select user_id, status into v_user_id, v_status from public.rounds where id = v_round_id;
  if v_user_id is null then return null; end if;
  insert into public.round_input_events (round_id, user_id, event_type, hole_number)
  values (v_round_id, v_user_id, 'hole_corrected', v_hole);
  if v_status = 'completed' then
    update public.round_integrity set status = 'review_required',
      reason_codes = array_append(reason_codes, 'post_completion_correction'),
      correction_event_count = correction_event_count + 1
    where round_id = v_round_id;
  end if;
  return null;
end;
$$;
create trigger capture_hole_correction_after_write
  after insert or update or delete on public.round_holes
  for each row execute function private.capture_hole_correction();

revoke all on function private.assess_round_time(uuid) from public, anon, authenticated;
revoke all on function private.lock_round_clock(), private.lock_shot_clock(),
  private.capture_round_integrity(), private.capture_shot_input(), private.capture_hole_correction()
  from public, anon, authenticated;
