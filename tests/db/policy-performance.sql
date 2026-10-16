-- Row level security policies read the signed-in user once per query, and every foreign key in public
-- has an index that starts with its columns. Run as the database owner; nothing is changed.
do $$
declare
  v_found text;
begin
  -- auth.uid()를 (select auth.uid())로 감싸지 않으면 행마다 다시 계산한다.
  select string_agg(tablename || ' "' || policyname || '"', ', ' order by tablename, policyname) into v_found
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and (replace(coalesce(qual, ''), '( SELECT auth.uid() AS uid)', '') like '%auth.uid()%'
      or replace(coalesce(with_check, ''), '( SELECT auth.uid() AS uid)', '') like '%auth.uid()%');
  if v_found is not null then raise exception 'Policies re-evaluate auth.uid() per row: %', v_found; end if;

  select string_agg(c.conrelid::regclass::text || ' ' || c.conname, ', ' order by 1) into v_found
  from pg_catalog.pg_constraint c
  join pg_catalog.pg_namespace n on n.oid = c.connamespace
  where c.contype = 'f' and n.nspname = 'public'
    and not exists (
      select 1 from pg_catalog.pg_index i
      where i.indrelid = c.conrelid
        and (i.indkey::int2[])[0:cardinality(c.conkey) - 1] @> c.conkey
        and (i.indkey::int2[])[0:cardinality(c.conkey) - 1] <@ c.conkey
    );
  if v_found is not null then raise exception 'Foreign keys without an index: %', v_found; end if;
end $$;
