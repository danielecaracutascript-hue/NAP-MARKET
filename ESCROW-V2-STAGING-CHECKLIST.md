# Escrow v2 staging: authorization and atomicity requirements

The `escrow_v2_assignments` table is intentionally private and unused by
the live order flow. Do not expose a service-role insert API directly.

## Required transaction before activation

Implement one audited, database-atomic operation that:

1. Authenticates the buyer and locks the order row (`FOR UPDATE`).
2. Confirms the order is `CREATED`, unfunded, and has no escrow address.
3. Selects an eligible, active arbiter other than the buyer and seller.
4. Confirms all three public keys and the order's derivation index are stable.
5. Recomputes or independently validates the Bitcoin Core descriptor and
   derived address against the supplied values.
6. Inserts exactly one immutable assignment, and binds the same assignment
   to the order before any payment details are exposed.
7. Handles concurrent requests idempotently, returning the same immutable
   assignment rather than selecting a different arbiter.
8. Never writes seeds, mnemonics, xprvs, or server-held signing secrets.

**Important:** the existing migration currently records a candidate
assignment only; it does not enforce all of these conditions by itself.
A privileged service-role process could still insert inconsistent records.
FORCE RLS also means ordinary table-owner access is restricted; the eventual
writer needs a carefully audited, explicitly privileged transaction.

## Regtest acceptance checks

- Three distinct device-controlled keys derive one reproducible address.
- Buyer + seller, buyer + arbiter, seller + arbiter can spend using valid PSBTs.
- Any one signer alone cannot spend.
- Wrong network, substituted arbiter, changed payout, excessive fee, stale
  funding outpoint and replayed transaction are rejected.
- A simultaneous second assignment request cannot change the address.
- Existing legacy escrow orders remain spendable through the legacy
  test-network-only flow.
- Broadcast succeeds but database write fails: reconciliation is safe.

Do not enable mainnet until independent review and full integration tests.
