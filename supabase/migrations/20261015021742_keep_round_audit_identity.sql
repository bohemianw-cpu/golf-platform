-- Preserve the identity and first completion clock behind the audit trail.
create or replace function private.lock_round_clock()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := clock_timestamp();
    new.started_at := new.created_at;
    if new.status = 'completed' then new.completed_at := new.created_at; end if;
  else
    if old.status = 'completed' and new.status is distinct from 'completed' then
      raise exception 'A completed round cannot return to in progress';
    end if;
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

create function private.lock_hole_identity()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.round_id is distinct from old.round_id or new.hole_number is distinct from old.hole_number then
    raise exception 'A hole cannot be moved to another round or hole number';
  end if;
  return new;
end;
$$;
create trigger lock_hole_identity_before_update
  before update on public.round_holes for each row execute function private.lock_hole_identity();
revoke all on function private.lock_round_clock(), private.lock_hole_identity() from public, anon, authenticated;
