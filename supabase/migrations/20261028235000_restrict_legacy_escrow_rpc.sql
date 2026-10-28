-- Staging security hardening for the existing privileged escrow RPC.
-- This migration only revokes execution by untrusted roles; it does not
-- change the existing function body or alter funded orders.
revoke all on function public.set_order_escrow(uuid, text, text, text)
  from public, anon, authenticated;

-- Backend service-role access remains available through the function owner
-- and its existing privileges. Verify service-role execution in staging
-- before deploying this migration to production.
