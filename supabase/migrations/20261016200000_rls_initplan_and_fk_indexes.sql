-- 사용자가 늘어도 느려지지 않도록 보안 규칙과 색인을 고친다. 누가 무엇을 볼 수 있는지는 바뀌지 않는다.
--
-- 1) 보안 규칙의 auth.uid()를 (select auth.uid())로 감싼다.
--    감싸지 않으면 조회한 행마다 로그인 사용자를 다시 계산하고, 감싸면 쿼리마다 한 번만 계산한다.
--    alter policy는 조건만 바꾸고 대상 역할과 명령(조회·생성 등)은 그대로 둔다.

alter policy "본인 라운드만 조회" on public.rounds
  using ((select auth.uid()) = user_id);
alter policy "본인 라운드만 생성" on public.rounds
  with check ((select auth.uid()) = user_id);
alter policy "본인 라운드만 수정" on public.rounds
  using ((select auth.uid()) = user_id);

alter policy "본인 홀 기록만 조회" on public.round_holes
  using (exists (select 1 from public.rounds where rounds.id = round_holes.round_id and rounds.user_id = (select auth.uid())));
alter policy "본인 홀 기록만 생성" on public.round_holes
  with check (exists (select 1 from public.rounds where rounds.id = round_holes.round_id and rounds.user_id = (select auth.uid())));
alter policy "본인 홀 기록만 수정" on public.round_holes
  using (exists (select 1 from public.rounds where rounds.id = round_holes.round_id and rounds.user_id = (select auth.uid())));
alter policy "본인 홀 기록만 삭제" on public.round_holes
  using (exists (select 1 from public.rounds where rounds.id = round_holes.round_id and rounds.user_id = (select auth.uid())));

alter policy "round owners manage their shots" on public.round_shots
  using (exists (select 1 from public.rounds r where r.id = round_shots.round_id and r.user_id = (select auth.uid())))
  with check (exists (select 1 from public.rounds r where r.id = round_shots.round_id and r.user_id = (select auth.uid())));

alter policy "participants can read friend requests" on public.friend_connections
  using ((select auth.uid()) = requester_id or (select auth.uid()) = addressee_id);
alter policy "participants can remove friend connections" on public.friend_connections
  using ((select auth.uid()) = requester_id or (select auth.uid()) = addressee_id);
alter policy "recipients can respond to friend requests" on public.friend_connections
  using ((select auth.uid()) = addressee_id and status = 'pending')
  with check ((select auth.uid()) = addressee_id and status in ('accepted', 'rejected'));
alter policy "users can request friends" on public.friend_connections
  with check ((select auth.uid()) = requester_id and status = 'pending');

-- 2) 다른 표를 가리키는 열에 색인을 단다.
--    라운드는 앱이 "내 라운드를 최근 순으로" 찾으므로 그 순서대로 색인한다.
create index if not exists rounds_user_created_idx on public.rounds (user_id, created_at desc);
create index if not exists round_input_events_user_idx on public.round_input_events (user_id);
create index if not exists user_data_consent_events_user_idx on public.user_data_consent_events (user_id);
create index if not exists friend_connections_addressee_idx on public.friend_connections (addressee_id);
create index if not exists commerce_entitlements_product_idx on public.commerce_entitlements (product_code);
create index if not exists commerce_orders_product_idx on public.commerce_orders (product_code);
create index if not exists commerce_point_events_order_idx on public.commerce_point_events (related_order_id);
