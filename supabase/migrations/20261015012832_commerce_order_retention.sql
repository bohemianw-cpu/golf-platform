-- Retain the minimum order record for five years, then purge it automatically.
-- A legal hold is an exceptional, documented operations decision.
alter table public.commerce_orders
  alter column retain_until set default (now() + interval '5 years'),
  add column legal_hold boolean not null default false;
update public.commerce_orders
set retain_until = coalesce(paid_at, created_at) + interval '5 years'
where retain_until is null;
alter table public.commerce_orders alter column retain_until set not null;

create function public.set_commerce_order_retention()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.retain_until := coalesce(new.paid_at, new.created_at) + interval '5 years';
  elsif old.paid_at is null and new.paid_at is not null then
    new.retain_until := new.paid_at + interval '5 years';
  end if;
  return new;
end;
$$;
create trigger set_commerce_order_retention_before_write
  before insert or update of paid_at on public.commerce_orders
  for each row execute function public.set_commerce_order_retention();

alter table public.commerce_entitlements drop constraint commerce_entitlements_order_id_fkey;
alter table public.commerce_entitlements add constraint commerce_entitlements_order_id_fkey
  foreign key (order_id) references public.commerce_orders(id) on delete set null;
alter table public.commerce_point_events drop constraint commerce_point_events_related_order_id_fkey;
alter table public.commerce_point_events add constraint commerce_point_events_related_order_id_fkey
  foreign key (related_order_id) references public.commerce_orders(id) on delete set null;
alter table public.commerce_referrals drop constraint commerce_referrals_qualified_order_id_fkey;
alter table public.commerce_referrals add constraint commerce_referrals_qualified_order_id_fkey
  foreign key (qualified_order_id) references public.commerce_orders(id) on delete set null;

select cron.schedule(
  'purge_golf_commerce_orders_daily',
  '41 3 * * *',
  $$delete from public.commerce_orders where retain_until <= now() and not legal_hold$$
);
