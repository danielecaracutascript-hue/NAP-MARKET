-- Staging regression: required escrow v2 arguments must fail closed.
begin;
do $$
begin
  begin
    perform public.escrow_v2_require_inputs(
      null, null, null, null, null, null, null, null, null, null, null
    );
    raise exception 'Expected missing-input validation to reject null arguments';
  exception
    when raise_exception then
      if sqlerrm = 'Expected missing-input validation to reject null arguments' then
        raise;
      end if;
  end;

  begin
    perform public.escrow_v2_require_inputs(
      '00000000-0000-0000-0000-000000000001'::uuid,
      '00000000-0000-0000-0000-000000000002'::uuid,
      '00000000-0000-0000-0000-000000000003'::uuid,
      '00000000-0000-0000-0000-000000000004'::uuid,
      0, 'regtest', 'descriptor', 'address', '', 'key', 'key'
    );
    raise exception 'Expected empty-key validation to reject input';
  exception
    when raise_exception then
      if sqlerrm = 'Expected empty-key validation to reject input' then
        raise;
      end if;
  end;
end
$$;
rollback;
