-- Commercial records are prepared but cannot be sold or issued by browser clients.
-- A payment provider, merchant identity, prices, and refund policy must be set before activation.
create table public.commerce_products (
  code text primary key check (code in ('ROUND_9', 'ROUND_12', 'ROUND_18')),
  title text not null,
  holes_count integer not null check (holes_count in (9, 12, 18)),
  price_krw integer check (price_krw > 0),
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  terms_version text,
  updated_at timestamptz not null default now(),
  constraint active_product_is_complete check (status <> 'active' or (price_krw is not null and terms_version is not null))
);
insert into public.commerce_products (code, title, holes_count) values
  ('ROUND_9', '9홀 이용권', 9),
  ('ROUND_12', '12홀 이용권', 12),
  ('ROUND_18', '18홀 이용권', 18);

-- Payment records survive account withdrawal for the statutory commerce retention period.
-- The account link is removed on withdrawal; no email, phone number, or shot data is stored here.
create table public.commerce_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  product_code text not null references public.commerce_products(code),
  product_title text not null,
  list_price_krw integer not null check (list_price_krw >= 0),
  point_discount_krw integer not null default 0 check (point_discount_krw >= 0),
  paid_amount_krw integer not null check (paid_amount_krw >= 0),
  status text not null check (status in ('pending', 'paid', 'cancelled', 'refunded', 'partially_refunded')),
  provider text,
  provider_payment_key text unique,
  provider_order_id text unique,
  policy_version text not null,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  refunded_at timestamptz,
  retain_until timestamptz,
  constraint order_amounts_match check (list_price_krw = point_discount_krw + paid_amount_krw),
  constraint paid_order_has_payment_time check (status not in ('paid', 'refunded', 'partially_refunded') or paid_at is not null)
);
create index commerce_orders_user_created_idx on public.commerce_orders (user_id, created_at desc);

-- A pass can be bound to one round exactly once. Editing/resuming that round never consumes another pass.
create table public.commerce_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid unique references public.commerce_orders(id),
  product_code text not null references public.commerce_products(code),
  status text not null default 'available' check (status in ('available', 'used', 'revoked')),
  round_id uuid unique,
  issued_at timestamptz not null default now(),
  used_at timestamptz,
  expires_at timestamptz,
  constraint pass_use_is_consistent check ((status = 'used') = (round_id is not null and used_at is not null))
);
create index commerce_entitlements_user_status_idx on public.commerce_entitlements (user_id, status, issued_at desc);

-- Signed, append-only event ledger. event_key prevents duplicate reward/discount events.
-- The provider integration must allocate expiring grants and atomically reject overspending.
create table public.commerce_point_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null,
  event_type text not null check (event_type in ('referral_reward', 'achievement_reward', 'purchase_discount', 'reversal', 'expiry', 'manual_adjustment')),
  points_delta integer not null check (points_delta <> 0),
  related_order_id uuid references public.commerce_orders(id),
  related_round_id uuid,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, event_key)
);
create index commerce_point_events_user_created_idx on public.commerce_point_events (user_id, created_at desc);

-- Referral identity and award are resolved only after the invited user's first valid paid use.
create table public.commerce_referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);
create table public.commerce_referrals (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invitee_id uuid not null unique references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'qualified', 'rejected', 'reversed')),
  qualified_order_id uuid unique references public.commerce_orders(id),
  created_at timestamptz not null default now(),
  qualified_at timestamptz,
  constraint no_self_referral check (inviter_id <> invitee_id)
);
create index commerce_referrals_inviter_idx on public.commerce_referrals (inviter_id, created_at desc);

alter table public.commerce_products enable row level security;
alter table public.commerce_orders enable row level security;
alter table public.commerce_entitlements enable row level security;
alter table public.commerce_point_events enable row level security;
alter table public.commerce_referral_codes enable row level security;
alter table public.commerce_referrals enable row level security;

revoke all on public.commerce_products, public.commerce_orders, public.commerce_entitlements,
  public.commerce_point_events, public.commerce_referral_codes, public.commerce_referrals
  from public, anon, authenticated;
grant select on public.commerce_products, public.commerce_orders, public.commerce_entitlements,
  public.commerce_point_events, public.commerce_referral_codes, public.commerce_referrals
  to authenticated;

create policy "read active products" on public.commerce_products for select to authenticated
  using (status = 'active');
create policy "read own orders" on public.commerce_orders for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "read own passes" on public.commerce_entitlements for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "read own points" on public.commerce_point_events for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "read own referral code" on public.commerce_referral_codes for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "read own referrals" on public.commerce_referrals for select to authenticated
  using ((select auth.uid()) = inviter_id or (select auth.uid()) = invitee_id);
