-- Anonymous visitors cannot write any public table, signed-in users cannot truncate tables or edit the
-- course catalog, and legacy signup objects stay removed. Run as the database owner; nothing is changed.
do $$
declare
  v_found text;
begin
  select string_agg(table_name || ' ' || privilege_type, ', ' order by table_name, privilege_type) into v_found
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee = 'anon'
    and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER');
  if v_found is not null then raise exception 'Anonymous visitors can write: %', v_found; end if;

  select string_agg(table_name || ' ' || privilege_type, ', ' order by table_name, privilege_type) into v_found
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee = 'authenticated'
    and (privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')
      or (table_name like 'golf_course%' and privilege_type in ('INSERT', 'UPDATE', 'DELETE')));
  if v_found is not null then raise exception 'Signed-in users have extra privileges: %', v_found; end if;

  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'rounds' and column_name = 'user_id' and is_nullable = 'YES') then
    raise exception 'Rounds can be saved without an owner';
  end if;

  select string_agg(name, ', ') into v_found
  from unnest(array['posts', 'group_buys', 'round_scores', 'pros', 'lesson_inquiries', 'user_clubs']) as name
  where pg_catalog.to_regclass('public.' || name) is not null;
  if v_found is not null then raise exception 'Unused legacy tables still exist: %', v_found; end if;

  if exists (select 1 from pg_catalog.pg_trigger
             where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_created') then
    raise exception 'The duplicate signup profile trigger still exists';
  end if;
end;
$$;

select 'public table privileges are restricted' as result;
