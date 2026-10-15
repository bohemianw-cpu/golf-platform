-- Putt distances need 0.1 m precision for accurate approach-rate calculations.
alter table public.round_shots
  alter column distance_to_pin_before type numeric(7,1),
  alter column distance_to_pin_after type numeric(7,1),
  alter column shot_distance type numeric(7,1);

-- Older projects retain these columns and synchronize them with the normalized
-- values in the round_shots trigger. Preserve the same precision there.
do $$
begin
  if (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'round_shots'
      and column_name in ('remaining_dist', 'shot_dist')
  ) = 2 then
    alter table public.round_shots
      alter column remaining_dist type numeric(7,1),
      alter column shot_dist type numeric(7,1);
  end if;
end;
$$;
