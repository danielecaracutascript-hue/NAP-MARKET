-- Additional escrow v2 staging regression checks.
-- Run after all escrow v2 migrations, on a disposable test database.
begin;
do $$
declare
  trigger_count integer;
begin
  select count(*) into trigger_count
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'escrow_v2_assignments'
    and not t.tgisinternal
    and t.tgenabled <> 'D'
    and t.tgname in ('escrow_v2_assignment_immutable', 'escrow_v2_assignment_validate');
  if trigger_count <> 2 then
    raise exception 'Expected two enabled escrow v2 integrity triggers, found %', trigger_count;
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'escrow_v2_assignments'
      and indexname = 'escrow_v2_unique_address'
  ) then
    raise exception 'Missing unique network/address index';
  end if;
end;
$$;
rollback;
