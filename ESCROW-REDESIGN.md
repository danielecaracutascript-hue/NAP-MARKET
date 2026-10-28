# Non-custodial escrow redesign

## Goal

The marketplace must never hold a private key capable of signing an order escrow. A database status or platform administrator must not be able to move escrow funds. Every spend must be authorized by user/arbiter keys and independently validated before broadcast.

## Required on-chain policy

Use a per-order descriptor with three independent extended public keys: buyer, seller, and the arbiter selected for that order. The arbiter must be selected before the funding address is shown and cannot be changed after funds arrive.

Primary branch: `multi(2, buyer_key, seller_key, arbiter_key)`.

This 2-of-3 policy supports:
- Normal completion: buyer + seller.
- Dispute decided for buyer: buyer + arbiter.
- Dispute decided for seller: seller + arbiter.

Optional recovery branch: buyer-only after a long relative timelock, e.g. `and_v(v:pk(buyer_key),older(6480))` (approximately 45 days at 10 minutes per block). The exact delay is a product/security decision and must be tested against the order's maximum lifetime. The recovery branch must not allow an early unilateral spend.

Use a canonical descriptor format supported by the selected Bitcoin Core and Miniscript libraries, derive and verify the descriptor/address on two independent implementations, and store the exact descriptor and script policy immutably with the order before funding.

## Key handling

- Buyer and seller private keys stay on their own devices; only xpubs are registered.
- The assigned arbiter's private key stays on that arbiter's device; only its xpub is used to derive the order script.
- The server may store unsigned PSBTs and public derivation metadata, but it must not load a platform mnemonic, seed, xprv, or sign an escrow input.
- Remove `PLATFORM_MNEMONIC` from the release/refund execution path. Do not simply delete the environment variable before replacing the descriptor and signing flow; that would break current spends and could strand test funds.

## Funding and order binding

1. Select an eligible arbiter at order/escrow creation, not only when a dispute is opened.
2. Persist `arbiter_id`, buyer/seller/arbiter xpub fingerprints, descriptor, derivation index, script/address, and expected escrow/shipping amounts in one atomic database operation.
3. Return the payment address only after the database confirms that immutable binding.
4. On funding detection, validate the exact outpoint and amount, required confirmation count, and the separately paid shipping amount. Reject ambiguous/multiple-payment cases into manual test review rather than silently selecting an arbitrary UTXO.

## Signing and dispute resolution

- Every signer independently parses the PSBT and verifies the funding outpoint, descriptor/script, amount, destination addresses, fee ceiling, and order status.
- The API must not sign. It stores and relays PSBTs/transactions only after verifying required signatures and policy.
- A decision in Supabase is workflow metadata, not a Bitcoin authorization. The winning party and arbiter must co-sign the transaction that matches that decision.
- Use idempotent state transitions and compare-and-set semantics for release/refund broadcasts; store txid before returning success, and reconcile if the node broadcast succeeds but the database update fails.

## Database requirements

The repository now includes a targeted Supabase hardening migration and RPC privilege regression checks, but it still does not include a complete baseline for the tables, constraints, indexes, grants, RLS policies, and RPC definitions. Before changing the application to this design, export and version that full baseline. Add migration(s) for immutable escrow key/descriptor binding and arbiter assignment, and audit `open_dispute`, `decide_dispute`, `mark_order_funded`, `mark_order_released`, and `mark_order_refunded` for authorization, concurrency, and replay safety.

Do not infer that a client-side role check is sufficient. Every privileged RPC must validate `auth.uid()` and the caller's relationship to the order/dispute within the database transaction.

## Mandatory tests before considering this implemented

1. Verify the descriptor is solvable and addresses match across Bitcoin Core and the browser library.
2. Prove each valid signer pair can spend the correct branch and each single key cannot spend early.
3. Prove the platform has no private key and cannot sign or broadcast an escrow spend on its own.
4. Test each dispute outcome, buyer timeout recovery, wrong key, wrong order, wrong outpoint, wrong output, excessive fee, malformed PSBT, replayed submission, concurrent release/refund, and database failure after broadcast.
5. Run all transaction scenarios on isolated regtest; then repeat integration checks on Signet with test funds only.

## Current status

This is a design requirement, not a claim that the current code already implements it. The current prototype still has a platform signing key in the release/refund flow and a descriptor that does not contain a distinct arbiter key. Keep the pull request in draft and do not use real funds until this redesign and the Supabase audit are implemented and tested.
