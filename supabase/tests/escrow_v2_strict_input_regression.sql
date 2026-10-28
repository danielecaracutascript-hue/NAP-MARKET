-- Regression checks for stricter staging escrow input validation.
begin;
do $$
begin
  begin
    perform public.escrow_v2_require_inputs(
      '00000000-0000-0000-0000-000000000001'::uuid,
      '00000000-0000-0000-0000-000000000002'::uuid,
      '00000000-0000-0000-0000-000000000003'::uuid,
      '00000000-0000-0000-0000-000000000004'::uuid,
      0, 'main', 'descriptor', 'address', 'buyer', 'seller', 'arbiter'
    );
    raise exception 'Expected invalid network rejection';
  exception when raise_exception then
    if sqlerrm <> 'Invalid escrow v2 network or derivation index' then raise; end if;
  end;
  begin
    perform public.escrow_v2_require_inputs(
      '00000000-0000-0000-0000-000000000001'::uuid,
      '00000000-0000-0000-0000-000000000002'::uuid,
      '00000000-0000-0000-0000-000000000002'::uuid,
      '00000000-0000-0000-0000-000000000004'::uuid,
      0, 'regtest', 'descriptor', 'address', 'buyer', 'seller', 'arbiter'
    );
    raise exception 'Expected duplicate participant rejection';
  exception when raise_exception then
    if sqlerrm <> 'Escrow v2 participants must be distinct' then raise; end if;
  end;
end
$$;
rollback;
