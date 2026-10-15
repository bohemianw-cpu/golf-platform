drop policy if exists "본인 라운드만 삭제" on public.rounds;
create policy "본인 라운드만 삭제" on public.rounds
  for delete to authenticated using (
    (select auth.uid()) = user_id and registered_at is null
  );
