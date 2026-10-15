-- Exercise the live authenticated database with synthetic data only.
-- Every insert, update, and delete below is rolled back at the end.
begin;
select set_config('request.jwt.claim.sub',
  (select user_id::text from public.rounds where user_id is not null limit 1), true);
set local role authenticated;

do $$
declare
  v_user uuid := auth.uid();
  v_round uuid;
  v_sample uuid;
  v_round_count integer;
  v_shot_count integer;
  v_point_count integer;
  v_rows integer;
begin
  if v_user is null then raise exception 'No account available for the rollback test'; end if;
  select count(*) into v_round_count from public.rounds where user_id = v_user;
  select count(*) into v_shot_count from public.round_shots;
  select count(*) into v_point_count from public.commerce_point_events where user_id = v_user;

  insert into public.sample_round_sessions (user_id, payload)
  values (v_user, '{"golfClubName":"rollback test","completedHoles":[]}'::jsonb)
  returning id into v_sample;
  if not exists (select 1 from public.sample_round_sessions where id = v_sample) or
     (select count(*) from public.rounds where user_id = v_user) <> v_round_count or
     (select count(*) from public.round_shots) <> v_shot_count or
     (select count(*) from public.commerce_point_events where user_id = v_user) <> v_point_count then
    raise exception 'Sample data affected real rounds, shots, or points';
  end if;

  insert into public.rounds (user_id, club_name, golf_club, course_name,
    play_mode, entry_mode, holes_count, status)
  values (v_user, 'rollback test', 'rollback test', 'OUT / IN',
    'field', 'live', 2, 'in_progress')
  returning id into v_round;

  insert into public.round_shots (round_id, hole_number, shot_number, club,
    distance_to_pin_before, distance_to_pin_after, shot_distance, ball_lie, penalty, input_method)
  values (v_round, 1, 1, '드라이버', 400, 0, 400, '홀아웃', 0, 'manual');
  update public.round_shots set club = '3W' where round_id = v_round and hole_number = 1;
  if (select club from public.round_shots where round_id = v_round and hole_number = 1) <> '3W' then
    raise exception 'Shot correction failed';
  end if;
  delete from public.round_shots where round_id = v_round and hole_number = 1;
  if exists (select 1 from public.round_shots where round_id = v_round) then
    raise exception 'Shot undo failed';
  end if;
  insert into public.round_shots (round_id, hole_number, shot_number, club,
    distance_to_pin_before, distance_to_pin_after, shot_distance, ball_lie, penalty, input_method)
  values (v_round, 1, 1, '드라이버', 400, 0, 400, '홀아웃', 0, 'manual');
  if (select count(*) from public.round_shots where round_id = v_round) <> 1 then
    raise exception 'Shot restore failed';
  end if;

  insert into public.round_holes (round_id, hole_number, par, score, putts, shots, total_distance)
  values (v_round, 1, 4, 1, 0, '[]'::jsonb, 400);
  begin
    update public.rounds set status = 'completed', total_score = 1,
      total_putts = 0, registered_at = clock_timestamp() where id = v_round;
    raise exception 'Incomplete round was registered';
  exception when others then
    if sqlerrm not like 'All round holes must be saved%' then raise; end if;
  end;

  insert into public.round_holes (round_id, hole_number, par, score, putts, shots, total_distance)
  values (v_round, 2, 3, 1, 1, '[]'::jsonb, 2);
  begin
    update public.rounds set status = 'completed', total_score = 2,
      total_putts = 1, registered_at = clock_timestamp() where id = v_round;
    raise exception 'Round without a final shot was registered';
  exception when others then
    if sqlerrm not like 'Every hole must have a saved hole-out shot%' then raise; end if;
  end;

  insert into public.round_shots (round_id, hole_number, shot_number, club,
    distance_to_pin_before, distance_to_pin_after, shot_distance, ball_lie, penalty, input_method)
  values (v_round, 2, 1, '퍼터', 2, 0, 2, '홀아웃', 0, 'manual');
  begin
    update public.rounds set status = 'completed', total_score = 3,
      total_putts = 1, registered_at = clock_timestamp() where id = v_round;
    raise exception 'Round with incorrect totals was registered';
  exception when others then
    if sqlerrm not like 'Round totals do not match saved holes%' then raise; end if;
  end;
  update public.rounds set status = 'completed', total_score = 2,
    total_putts = 1, registered_at = clock_timestamp() where id = v_round;
  if not exists (select 1 from public.rounds where id = v_round and registered_at is not null) then
    raise exception 'Complete round registration failed';
  end if;

  begin
    update public.round_shots set club = 'PW' where round_id = v_round;
    raise exception 'Registered shot edit was allowed';
  exception when others then
    if sqlerrm not like 'This round has been registered%' then raise; end if;
  end;
  begin
    update public.round_holes set score = 2 where round_id = v_round;
    raise exception 'Registered hole edit was allowed';
  exception when others then
    if sqlerrm not like 'This round has been registered%' then raise; end if;
  end;
  begin
    update public.rounds set total_score = 3 where id = v_round;
    raise exception 'Registered round edit was allowed';
  exception when others then
    if sqlerrm not like 'This round has been registered%' then raise; end if;
  end;
  delete from public.rounds where id = v_round;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'Registered round deletion was allowed'; end if;
end;
$$;

select 'sample isolation, shot undo/restore, completion validation, and registration lock passed' as result;
rollback;
