-- A round started before audit installation cannot become time-supported later.
update public.round_integrity
set reason_codes = array_append(reason_codes, 'legacy_without_audit')
where status = 'in_progress' and not ('legacy_without_audit' = any(reason_codes));

create or replace function private.assess_round_time(p_round_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_round public.rounds%rowtype;
  v_holes integer;
  v_observed integer;
  v_minimum integer;
  v_shots integer;
  v_legacy boolean;
  v_status text;
  v_reasons text[] := '{}';
begin
  select * into v_round from public.rounds where id = p_round_id;
  if not found or v_round.user_id is null or v_round.status <> 'completed' then return; end if;
  select count(*) into v_holes from public.round_holes where round_id = p_round_id;
  select count(*) into v_shots from public.round_shots where round_id = p_round_id;
  select coalesce('legacy_without_audit' = any(reason_codes), false) into v_legacy
  from public.round_integrity where round_id = p_round_id;
  v_observed := greatest(0, floor(extract(epoch from (v_round.completed_at - v_round.started_at)))::integer);
  v_minimum := v_round.holes_count * case when v_round.play_mode = 'screen' then 80 else 400 end;
  if v_legacy then
    v_status := 'self_reported';
    v_reasons := array_append(v_reasons, 'legacy_without_audit');
  elsif v_round.entry_mode = 'backfill' then
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
revoke all on function private.assess_round_time(uuid) from public, anon, authenticated;
