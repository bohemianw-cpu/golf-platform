-- Run against a database with at least one round. All probes run in a transaction.
begin;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
-- Prefer an unregistered round so the registration lock trigger does not mask the RLS check.
select set_config('request.audit.round_id',
  (select id::text from public.rounds order by (registered_at is null) desc, created_at desc limit 1), true);
select set_config('request.audit.owner_id',
  (select user_id::text from public.rounds where id = current_setting('request.audit.round_id')::uuid), true);
set local role authenticated;

do $$
declare
  v_rows integer;
  v_round_id uuid := current_setting('request.audit.round_id')::uuid;
  v_owner_id uuid := current_setting('request.audit.owner_id')::uuid;
begin
  if v_round_id is null then raise exception 'No round available for access test'; end if;
  if (select count(*) from public.rounds) <> 0 then raise exception 'Another user can read rounds'; end if;
  if (select count(*) from public.round_holes) <> 0 then raise exception 'Another user can read holes'; end if;
  if (select count(*) from public.round_shots) <> 0 then raise exception 'Another user can read shots'; end if;

  update public.rounds set total_score = total_score where id = v_round_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'Another user can update a round'; end if;
  delete from public.rounds where id = v_round_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'Another user can delete a round'; end if;

  -- Writes into another user's round must be rejected by RLS, not by an unrelated error.
  begin
    insert into public.round_holes (round_id, hole_number, par, score, putts, fairway_hit, gir, shots, total_distance, green_code, green_name)
    values (v_round_id, 18, 4, 4, 2, null, false, '[]'::jsonb, 360, 'standard', '기본 그린');
    raise exception 'Another user can add holes to a round';
  exception
    when insufficient_privilege then null;
    when raise_exception then raise;
    when others then raise exception 'Hole insert probe was inconclusive: % (%)', sqlerrm, sqlstate;
  end;

  begin
    insert into public.round_shots (round_id, hole_number, shot_number, club, distance_to_pin_before, distance_to_pin_after, shot_distance, ball_lie, penalty)
    values (v_round_id, 18, 30, '드라이버', 360, 150, 210, '페어웨이', 0);
    raise exception 'Another user can add shots to a round';
  exception
    when insufficient_privilege then null;
    when raise_exception then raise;
    when others then raise exception 'Shot insert probe was inconclusive: % (%)', sqlerrm, sqlstate;
  end;

  begin
    insert into public.rounds (user_id, club_name, golf_club, course_name, play_mode, entry_mode, holes_count, status)
    values (v_owner_id, '검증용 CC', '검증용 CC', 'OUT/IN', 'field', 'live', 18, 'in_progress');
    raise exception 'A round can be created for another user';
  exception
    when insufficient_privilege then null;
    when raise_exception then raise;
    when others then raise exception 'Round insert probe was inconclusive: % (%)', sqlerrm, sqlstate;
  end;
end;
$$;

select 'cross-user access denied' as result;
rollback;
