# Security and verification report

Status: prototype/test environment only. This report is not a production security certification.

## Changes applied on this branch

- Removed the currently tracked `marketplace/.env.signet.backup` and `poc-firma/keys.json` files.
- Removed tracked editor backups and the accidentally tracked `poc-firma/node_modules` directory.
- Replaced setup-document secret values with local-only placeholders and removed instructions to place buyer/seller recovery phrases in server environment variables.
- Updated the key-export helper to print public extended keys only, not wallet recovery phrases.
- Added repository-wide ignore rules for local environment files, backups, key material, build output, and dependencies.
- Removed a duplicate `RefundKind` declaration and fixed duplicate/type errors in the order client.
- Pinned Next.js/Supabase dependency versions and refreshed the npm lockfile through CI.
- Upgraded Next.js and `eslint-config-next` to 16.4.3 after CI's production audit identified critical advisories affecting 16.3.8; the dependency install, lint, TypeScript, build, and production audit passed on the dependency-update commit.
- Migrated ESLint to the native Next.js 16 flat configuration.
- Made the address-network selection explicit: default to regtest and map signet to BitcoinJS testnet address parameters.
- Added GitHub Actions checks for dependency installation, lint, TypeScript, production build, and production dependency audit.
- Hardened the payment confirmation route to validate satoshi amounts as positive safe integers and require an unambiguous escrow funding output; overpayments or multiple matching outputs now require manual review rather than selecting the first UTXO.

## Database findings from the live Supabase export (2026-10-28)

The following findings are based on the RLS policies and RPC definitions exported during the review; they are not inferred from the application code alone.

- `confirm_delivery` was executable by `PUBLIC`/`anon` and selected a `SHIPPED` order without checking that the caller was its buyer. A migration now binds the transition to `auth.uid() = orders.buyer_id`, uses a fixed `search_path`, locks the row, and sets the product's 30-day delivery window.
- `confirm_payment` was executable by `PUBLIC`/`anon`/`authenticated` and accepts payment identifiers and amounts as arguments without checking the Bitcoin chain in the shown function body. The migration removes client-role execution; the supported app path should verify the payment server-side and call `mark_order_funded`.
- The test RPCs `simulate_payment`, `simulate_delivery`, and `test_expire_window` were executable by authenticated users and rely on database flags to gate behavior. The migration revokes API-role execution; an explicitly marked dev-only SQL script is provided to re-enable these only in a disposable test project.
- The `dispute_evidence` INSERT policy only checked `uploader_id = auth.uid()`, so it did not ensure the uploader was a party to the order or the assigned arbiter. The migration replaces it with a membership check.
- The exported `save_address` function stores `convert_to(trim(p_text), 'UTF8')` in `encrypted_payload`. That is a text-to-bytea conversion, not encryption. Treat existing address payloads as plaintext unless a separate verified encryption layer exists; plan an explicit encryption-at-rest remediation rather than assuming the column name provides protection.
- The exported order/dispute functions still contain 14-day wording/windows in places, while the product rule is 30 days. The migration corrects `confirm_delivery` only; `simulate_delivery`, `request_return`, `open_dispute`, `finalize_order`, and any client labels must be reconciled in a separate tested change.
- RLS is enabled but not forced on the exported tables. This is not automatically a vulnerability by itself (table owners and `SECURITY DEFINER` functions can bypass RLS), but it makes auditing function ownership, grants, and privileged call paths especially important.

Migration: `supabase/migrations/20261028120000_harden_rpc_and_dispute_evidence.sql`. Apply to a disposable staging Supabase project first and run the authorization tests before production. `supabase/tests/dev-only-simulation-grants.sql` is for isolated development projects only and must never be applied to production. This is an additive remediation, not a complete schema baseline.

## Findings that still block production

### 1. Platform private key is used by the server

The current release/refund code reads `PLATFORM_MNEMONIC` and signs PSBTs on the server. The current descriptor requires an additional buyer/seller signature in the relevant branch, so this is not a platform-only spend path; nevertheless, the platform private key is server-held and gives the platform a signing/veto role. This does not meet the stated goal that the marketplace never holds private keys. Do not use real funds until the escrow descriptor and signing flow are redesigned and tested.

### 2. The on-chain descriptor does not include a distinct arbiter key

The current descriptor uses platform, buyer, and seller keys, with timelock alternatives. The dispute decision is recorded in application/database state; the descriptor itself does not encode a separate randomly selected arbiter key. The dispute arbitration model must be reconciled with the on-chain spend conditions before production.

### 3. Database security cannot be fully verified from this repository

The branch now contains a targeted hardening migration based on the 2026-10-28 live export, but it is not a complete, reproducible baseline of the Supabase tables, constraints, indexes, grants, RLS policies, and RPC definitions. The authorization and atomicity of functions such as `open_dispute`, `decide_dispute`, `set_order_escrow`, release, and refund therefore remain only partially verified. Export the complete schema and version it before production.

### 4. Removing secrets from the current tree does not erase Git history

The files have been removed from the current branch tree, but their old commits remain in the public repository history. When the test phase is complete, rotate/revoke exposed credentials and consider a coordinated history rewrite if historical secret material must be removed. Rewriting history changes commit IDs and affects every clone.

### 5. Payment confirmation still needs end-to-end and concurrency tests

The confirmation route now rejects ambiguous or excessive escrow outputs instead of arbitrarily choosing one. The database RPC must still enforce an atomic, one-time transition from `CREATED` to funded, and the application must be tested against repeated/concurrent confirmation requests, reorgs, late payments, multiple partial payments, and duplicate outputs. A route-level check alone cannot guarantee atomicity.

### 6. End-to-end Bitcoin tests still require a node

CI validates installation, lint, TypeScript, build, and production dependency audit. It does not have access to the developer's local Bitcoin Core regtest/signet node or a live Supabase test project, so transaction broadcast, confirmation, dispute, refund, and recovery flows still require end-to-end testing against isolated test infrastructure.

## Release gate

- [ ] Rotate/revoke exposed Supabase credentials and verify the old credential no longer works.
- [ ] Export and version a complete Supabase schema baseline, then test all RLS policies and RPC functions against it.
- [ ] Run `supabase/tests/security_rpc_regression.sql` against staging after applying the hardening migration.
- [ ] Redesign the escrow so the marketplace does not hold a private signing key and the arbiter's authority is reflected correctly in the spend policy.
- [ ] Run end-to-end regtest tests for funding, release, refund, dispute outcomes, timelocks, malformed PSBTs, duplicate submissions, and restart/recovery.
- [ ] Review dependency audit output and repeat all CI checks on the final release commit.
