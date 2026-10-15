-- A refunded pass can remain bound to its original round for audit purposes.
alter table public.commerce_entitlements
  drop constraint pass_use_is_consistent,
  add constraint pass_use_is_consistent
  check (
    ((round_id is null) = (used_at is null))
    and (status <> 'used' or round_id is not null)
  );
