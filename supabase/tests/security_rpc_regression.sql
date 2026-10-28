-- Run with psql against a disposable/staging Supabase database AFTER
-- applying supabase/migrations/20261028120000_harden_rpc_and_dispute_evidence.sql.
-- This file is read-only: it asserts expected grants and function/policy guards.
-- It does not create fixture users/orders and does not send Bitcoin transactions.

do $tests$
declare
  v_definition text;
  v_policy_check text;
begin
  -- confirm_delivery must be available to signed-in users, not anon/PUBLIC.
  if has_function_privilege('anon', 'public.confirm_delivery(uuid)', 'EXECUTE') then
    raise exception 'SECURITY REGRESSION: anon can execute confirm_delivery';
  end if;
  if not has_function_privilege('authenticated', 'public.confirm_delivery(uuid)', 'EXECUTE') then
    raise exception 'CONFIGURATION ERROR: authenticated cannot execute confirm_delivery';
  end if;

  v_definition := pg_get_functiondef('public.confirm_delivery(uuid)'::regprocedure);
  if position('buyer_id = auth.uid()' in v_definition) = 0 then
    raise exception 'SECURITY REGRESSION: confirm_delivery does not bind caller to buyer';
  end if;
  if position('30 days' in v_definition) = 0 then
    raise exception 'PRODUCT REGRESSION: confirm_delivery window is not 30 days';
  end if;
  if position('for update' in lower(v_definition)) = 0 then
    raise exception 'CONCURRENCY REGRESSION: confirm_delivery no longer locks the order row';
  end if;

  -- This legacy RPC trusts caller-supplied payment data and must not be callable
  -- by API roles; the supported path verifies Bitcoin server-side first.
  if has_function_privilege('anon', 'public.confirm_payment(uuid,text,integer,bigint,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.confirm_payment(uuid,text,integer,bigint,text)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.confirm_payment(uuid,text,integer,bigint,text)', 'EXECUTE') then
    raise exception 'SECURITY REGRESSION: client/ API role can execute legacy confirm_payment';
  end if;

  -- Simulation helpers must not be exposed to API roles in a shared/staging DB.
  if has_function_privilege('anon', 'public.simulate_payment(uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.simulate_payment(uuid)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.simulate_payment(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.simulate_delivery(uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.simulate_delivery(uuid)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.simulate_delivery(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.test_expire_window(uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.test_expire_window(uuid)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.test_expire_window(uuid)', 'EXECUTE') then
    raise exception 'SECURITY REGRESSION: a simulation RPC is executable by an API role';
  end if;

  -- Evidence uploads must require both the caller identity and order/dispute
  -- membership, not merely uploader_id = auth.uid().
  select with_check into v_policy_check
    from pg_policies
   where schemaname = 'public'
     and tablename = 'dispute_evidence'
     and policyname = 'parties upload evidence'
     and cmd = 'INSERT';

  if v_policy_check is null then
    raise exception 'CONFIGURATION ERROR: expected dispute evidence INSERT policy is missing';
  end if;
  if position('uploader_id = auth.uid()' in v_policy_check) = 0
     or position('dispute_id' in v_policy_check) = 0
     or position('buyer_id' in v_policy_check) = 0
     or position('seller_id' in v_policy_check) = 0
     or position('arbiter_id' in v_policy_check) = 0 then
    raise exception 'SECURITY REGRESSION: evidence INSERT policy lacks uploader and participant checks';
  end if;
end;
$tests$;

select 'security_rpc_regression: PASS' as result;
