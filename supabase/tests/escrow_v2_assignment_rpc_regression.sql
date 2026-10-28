-- Staging-only metadata checks for the locked assignment RPC.
begin;
do $$
declare
  f oid;
begin
  select to_regprocedure(
    'public.assign_escrow_v2(uuid,uuid,uuid,uuid,text,text,text,integer,text,text,text)'
  ) into f;
  if f is null then
    raise exception 'Missing assign_escrow_v2 RPC';
  end if;
  if (select prosecdef from pg_proc where oid = f) then
    raise exception 'assign_escrow_v2 must remain SECURITY INVOKER';
  end if;
  if has_function_privilege('anon', f, 'EXECUTE')
     or has_function_privilege('authenticated', f, 'EXECUTE') then
    raise exception 'Untrusted roles must not execute assign_escrow_v2';
  end if;
end
$$;
rollback;
