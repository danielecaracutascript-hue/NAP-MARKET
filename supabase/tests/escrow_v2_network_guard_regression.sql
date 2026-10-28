-- Additional staging-only checks. Run on a disposable database after migrations.
begin;
do $$
declare
  definition text;
begin
  select pg_get_functiondef('public.escrow_v2_validate_assignment()'::regprocedure)
    into definition;
  if position('new.network' in definition) = 0
     or position('new.escrow_address' in definition) = 0
     or position('new.buyer_xpub' in definition) = 0 then
    raise exception 'Escrow v2 network validation is missing';
  end if;
end
$$;
rollback;
