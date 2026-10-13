-- A small number of official par-seven routes exceed the previous 800 m UI
-- and round-shot limit. Keep tee catalog, hole entry, and persisted shots aligned.
alter table public.round_shots
  drop constraint if exists round_shots_distance_before_range,
  drop constraint if exists round_shots_distance_after_range,
  drop constraint if exists round_shots_shot_distance_range;

alter table public.round_shots
  add constraint round_shots_distance_before_range
    check (distance_to_pin_before between 0 and 2000),
  add constraint round_shots_distance_after_range
    check (distance_to_pin_after between 0 and 2000),
  add constraint round_shots_shot_distance_range
    check (shot_distance between 0 and 2000);
