-- Calculate the complete ledger balance; the MY page may show only recent events.
create function public.my_commerce_point_balance()
returns bigint language sql stable security invoker set search_path = '' as $$
  select coalesce(sum(points_delta), 0)::bigint
  from public.commerce_point_events
  where user_id = (select auth.uid());
$$;
revoke all on function public.my_commerce_point_balance() from public, anon;
grant execute on function public.my_commerce_point_balance() to authenticated;
