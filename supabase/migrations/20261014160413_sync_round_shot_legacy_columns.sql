-- Existing projects retain required columns from the original round_shots table.
-- Keep them synchronized so normalized shot writes satisfy the old constraints.
do $$
begin
  if (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'round_shots'
      and column_name in ('lie', 'remaining_dist', 'shot_dist')
  ) = 3 then
    execute $function$
      create or replace function public.sync_round_shot_legacy_columns()
      returns trigger
      language plpgsql
      set search_path = pg_catalog
      as $body$
      begin
        new.lie := new.ball_lie;
        new.remaining_dist := new.distance_to_pin_before;
        new.shot_dist := new.shot_distance;
        return new;
      end;
      $body$;
    $function$;

    execute 'drop trigger if exists sync_round_shot_legacy_columns on public.round_shots';
    execute 'create trigger sync_round_shot_legacy_columns before insert or update on public.round_shots for each row execute function public.sync_round_shot_legacy_columns()';
  end if;
end;
$$;
