-- Staging regression: table constraints must exist independently of RPC.
begin;
do $$
declare
  found_count integer;
begin
  select count(*) into found_count
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'escrow_v2_assignments'
    and c.contype = 'c'
    and c.conname in (
      'escrow_v2_nonempty_keys',
      'escrow_v2_nonempty_descriptor_address',
      'escrow_v2_trimmed_distinct_keys'
    );
  if found_count <> 3 then
    raise exception 'Expected three escrow v2 table validation constraints, found %', found_count;
  end if;
end
$$;
rollback;
