-- A client must not register an incomplete round by calling the table API directly.
-- Existing registered rounds are left untouched; only a new completion is checked.
create function private.validate_round_completion()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_holes integer;
  v_score integer;
  v_putts integer;
begin
  if tg_op = 'INSERT' then
    if new.status = 'completed' or new.registered_at is not null then
      raise exception 'A round must be recorded before it can be registered';
    end if;
    return new;
  end if;

  if old.registered_at is null and new.registered_at is not null and
     new.status is distinct from 'completed' then
    raise exception 'Only a completed round can be registered';
  end if;

  if new.status = 'completed' and
     (old.status is distinct from 'completed' or
      (old.registered_at is null and new.registered_at is not null)) then
    if new.holes_count not between 1 and 18 then
      raise exception 'Invalid round hole count';
    end if;

    select count(*), coalesce(sum(h.score), 0), coalesce(sum(h.putts), 0)
      into v_holes, v_score, v_putts
    from public.round_holes h
    where h.round_id = new.id and h.hole_number between 1 and new.holes_count;

    if v_holes <> new.holes_count or
       exists (select 1 from public.round_holes h
               where h.round_id = new.id and h.hole_number not between 1 and new.holes_count) or
       exists (select 1 from generate_series(1, new.holes_count) n
               where not exists (select 1 from public.round_holes h
                                 where h.round_id = new.id and h.hole_number = n)) then
      raise exception 'All round holes must be saved before registration';
    end if;

    if new.total_score is distinct from v_score or new.total_putts is distinct from v_putts then
      raise exception 'Round totals do not match saved holes';
    end if;

    if exists (
      select 1 from generate_series(1, new.holes_count) n
      where not exists (
        select 1 from public.round_shots s
        where s.round_id = new.id and s.hole_number = n
          and s.shot_number = (
            select max(last_shot.shot_number) from public.round_shots last_shot
            where last_shot.round_id = new.id and last_shot.hole_number = n
          )
          and s.distance_to_pin_after = 0 and s.ball_lie = '홀아웃'
      )
    ) then
      raise exception 'Every hole must have a saved hole-out shot before registration';
    end if;
  end if;

  return new;
end;
$$;

create trigger validate_round_completion_before_write
  before insert or update on public.rounds
  for each row execute function private.validate_round_completion();

revoke all on function private.validate_round_completion() from public, anon, authenticated;
