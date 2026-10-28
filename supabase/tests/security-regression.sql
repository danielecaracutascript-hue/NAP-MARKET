-- Read-only catalog assertions for the 2026-10-28 hardening migration.
-- Run in Supabase SQL Editor on a DISPOSABLE STAGING project after applying
-- supabase/migrations/20261028120000_harden_rpc_and_dispute_evidence.sql.
-- Does not mutate user data or rely on test users. An exception means FAIL.
--
-- These checks do NOT replace end-to-end tests with authenticated JWTs,
-- a Bitcoin Core node, or real RLS role impersonation.
begin;
do $$
declare
  r record;
  f oid;
  fn text;
  pol record;
begin
  for r in
    select * from (values
      ('confirm_delivery(uuid)'::text),
      ('confirm_payment(uuid,text,integer,bigint,text)'),
      ('simulate_payment(uuid)'),
      ('simulate_delivery(uuid)'),
      ('test_expire_window(uuid)')
    ) v(signature)
  loop
    f := to_regprocedure('public.' || r.signature);
    if f is null then
      raise exception 'Missing required function: %', r.signature;
    end if;
    if has_function_privilege('anon', f, 'EXECUTE') then
      raise exception 'anon can execute %', r.signature;
    end if;
  end loop;

  foreach fn in array array[
    'confirm_payment(uuid,text,integer,bigint,text)',
    'simulate_payment(uuid)',
    'simulate_delivery(uuid)',
    'test_expire_window(uuid)'
  ]
  loop
    f := to_regprocedure('public.' || fn);
    if has_function_privilege('authenticated', f, 'EXECUTE') then
      raise exception 'authenticated can execute unsafe RPC %', fn;
    end if;
    if has_function_privilege('service_role', f, 'EXECUTE') then
      raise exception 'service_role can execute disabled RPC %', fn;
    end if;
  end loop;

  f := to_regprocedure('public.confirm_delivery(uuid)');
  if not has_function_privilege('authenticated', f, 'EXECUTE') then
    raise exception 'Authenticated buyers cannot execute confirm_delivery';
  end if;
  if not exists (
    select 1 from pg_proc
    where oid = f
      and prosecdef
      and proconfig @> array['search_path=public']::text[]
  ) then
    raise exception 'confirm_delivery must be SECURITY DEFINER with fixed search_path';
  end if;
  if position('buyer_id = auth.uid()' in pg_get_functiondef(f)) = 0
    or position('30 days' in pg_get_functiondef(f)) = 0 then
    raise exception 'confirm_delivery buyer check or 30-day window missing';
  end if;

  select * into pol
  from pg_policies
  where schemaname = 'public'
    and tablename = 'dispute_evidence'
    and policyname = 'parties upload evidence'
    and cmd = 'INSERT';
  if not found or pol.with_check is null
    or position('auth.uid()' in pol.with_check) = 0
    or position('orders' in pol.with_check) = 0
    or position('disputes' in pol.with_check) = 0 then
    raise exception 'dispute_evidence INSERT policy missing membership condition';
  end if;

  raise notice 'PASS: catalog privilege, buyer-check, and evidence-policy assertions';
end
$$;
rollback;
