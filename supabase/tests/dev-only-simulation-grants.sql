-- DEV / DISPOSABLE TEST PROJECT ONLY.
-- NEVER apply this file to staging shared with real users or production.
-- The production hardening migration revokes API execution on these test RPCs.
-- If the prototype's simulation UI is needed for local acceptance tests, apply
-- this script only to an isolated Supabase project with no real funds or users.

grant execute on function public.simulate_payment(uuid) to authenticated;
grant execute on function public.simulate_delivery(uuid) to authenticated;
grant execute on function public.test_expire_window(uuid) to authenticated;
