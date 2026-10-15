-- Run against a database with a registered round containing a hole and a shot.
-- Every attempted mutation is inside a transaction that is rolled back.
begin;
select set_config('request.jwt.claim.sub', (select r.user_id::text from public.rounds r where r.registered_at is not null
  and exists (select 1 from public.round_holes h where h.round_id = r.id)
  and exists (select 1 from public.round_shots s where s.round_id = r.id) limit 1), true);
select set_config('request.audit.round_id', (select r.id::text from public.rounds r where r.registered_at is not null
  and exists (select 1 from public.round_holes h where h.round_id = r.id)
  and exists (select 1 from public.round_shots s where s.round_id = r.id) limit 1), true);
set local role authenticated;

do $$
declare
  v_round_id uuid := current_setting('request.audit.round_id')::uuid;
  v_rows integer;
begin
  if v_round_id is null then raise exception 'No registered round available for lock test'; end if;

  begin
    update public.rounds set total_score = coalesce(total_score, 0) + 1 where id = v_round_id;
    raise exception 'Registered round update was allowed';
  exception when others then
    if sqlerrm not like 'This round has been registered%' then raise; end if;
  end;

  if not exists (select 1 from public.round_holes where round_id = v_round_id) then
    raise exception 'No registered hole available for lock test';
  end if;
  begin
    update public.round_holes set par = par where round_id = v_round_id;
    raise exception 'Registered hole update was allowed';
  exception when others then
    if sqlerrm not like 'This round has been registered%' then raise; end if;
  end;

  if not exists (select 1 from public.round_shots where round_id = v_round_id) then
    raise exception 'No registered shot available for lock test';
  end if;
  begin
    update public.round_shots set club = club where round_id = v_round_id;
    raise exception 'Registered shot update was allowed';
  exception when others then
    if sqlerrm not like 'This round has been registered%' then raise; end if;
  end;

  delete from public.rounds where id = v_round_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'Registered round deletion was allowed'; end if;
end;
$$;

select 'registered round mutation denied' as result;
rollback;
