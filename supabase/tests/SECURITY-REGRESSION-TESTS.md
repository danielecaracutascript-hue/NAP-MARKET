# Supabase security regression tests

Run these against a disposable/staging Supabase project after applying
`supabase/migrations/20261028120000_harden_rpc_and_dispute_evidence.sql`.
Do not run destructive setup against production data. Use three test users
(buyer, seller, unrelated user), one assigned arbiter, and separate orders.

## RPC authorization

- [ ] As `anon`, calling `confirm_delivery(order_id)` fails with permission denied.
- [ ] As an authenticated unrelated user, `confirm_delivery(order_id)` fails and the order remains `SHIPPED`.
- [ ] As the seller, `confirm_delivery(order_id)` fails and the order remains `SHIPPED`.
- [ ] As the buyer of a `SHIPPED` order, `confirm_delivery(order_id)` succeeds exactly once and sets `DELIVERED`.
- [ ] Repeating `confirm_delivery(order_id)` fails without adding a second successful transition.
- [ ] As `anon`, `authenticated`, or `service_role`, calling legacy `confirm_payment(...)` fails with permission denied. The supported server route must use Bitcoin Core verification and `mark_order_funded`, not this legacy RPC.

- [ ] As `authenticated`, `anon`, and `service_role`, calls to `simulate_payment`, `simulate_delivery`, and `test_expire_window` fail with permission denied in the hardened shared/live schema.
- [ ] Confirm the isolated dev-only simulation grant script is not part of any production deployment workflow.

## Dispute evidence authorization

- [ ] Buyer can insert evidence for their order's dispute with `uploader_id = auth.uid()`.
- [ ] Seller can insert evidence for their order's dispute with `uploader_id = auth.uid()`.
- [ ] The dispute's assigned arbiter can insert evidence with `uploader_id = auth.uid()`.
- [ ] An unrelated authenticated user cannot insert evidence even when they know a valid `dispute_id`.
- [ ] A caller cannot set `uploader_id` to another user's UUID.
- [ ] Read policies continue to restrict evidence to the order parties and assigned arbiter.

## Delivery window and data integrity

- [ ] A successful buyer delivery confirmation sets `window_ends_at` approximately 30 days after `delivered_at`.
- [ ] The buyer cannot confirm delivery before the order reaches `SHIPPED`.
- [ ] Two concurrent delivery-confirmation requests cannot create two successful transitions.
- [ ] Verify `order_events` has one corresponding `delivered` event after a successful transition.

## Review notes / acceptance

Record the Supabase project reference (never credentials), migration version,
test date, test role, expected result, actual result, and any SQL error. Also
verify grants directly through `information_schema.routine_privileges`.
These checks do not replace Bitcoin regtest tests or a review of the complete
RLS/function set.
