-- Regression checks for the escrow v2 staging migration.
-- Run in a disposable development database after applying migrations.
begin;
do $$
begin
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'escrow_v2_assignments'
      and c.relrowsecurity
  ) then
    raise exception 'escrow_v2_assignments must have RLS enabled';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'escrow_v2_assignments'
  ) then
    raise exception 'escrow v2 staging table must not expose client policies';
  end if;

  if has_table_privilege('anon', 'public.escrow_v2_assignments', 'INSERT')
     or has_table_privilege('authenticated', 'public.escrow_v2_assignments', 'INSERT')
     or has_table_privilege('anon', 'public.escrow_v2_assignments', 'UPDATE')
     or has_table_privilege('authenticated', 'public.escrow_v2_assignments', 'UPDATE')
     or has_table_privilege('anon', 'public.escrow_v2_assignments', 'DELETE')
     or has_table_privilege('authenticated', 'public.escrow_v2_assignments', 'DELETE')
  then
    raise exception 'escrow v2 staging table grants are too permissive';
  end if;
end
$$;
rollback;
