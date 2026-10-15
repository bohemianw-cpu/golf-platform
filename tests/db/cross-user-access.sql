-- Run against a database with at least one round. All probes run in a transaction.
begin;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.audit.round_id', (select id::text from public.rounds limit 1), true);
set local role authenticated;

do $$
declare
  v_rows integer;
  v_round_id uuid := current_setting('request.audit.round_id')::uuid;
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
end;
$$;

select 'cross-user access denied' as result;
rollback;
