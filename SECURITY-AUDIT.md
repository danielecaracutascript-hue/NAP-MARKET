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
- Migrated ESLint to the native Next.js 16 flat configuration.
- Made the address-network selection explicit: default to regtest and map signet to BitcoinJS testnet address parameters.
- Added GitHub Actions checks for dependency installation, lint, TypeScript, production build, and production dependency audit.

## Findings that still block production

### 1. Platform private key is used by the server

The current release/refund code reads `PLATFORM_MNEMONIC` and signs PSBTs on the server. The current descriptor requires an additional buyer/seller signature in the relevant branch, so this is not a platform-only spend path; nevertheless, the platform private key is server-held and gives the platform a signing/veto role. This does not meet the stated goal that the marketplace never holds private keys. Do not use real funds until the escrow descriptor and signing flow are redesigned and tested.

### 2. The on-chain descriptor does not include a distinct arbiter key

The current descriptor uses platform, buyer, and seller keys, with timelock alternatives. The dispute decision is recorded in application/database state; the descriptor itself does not encode a separate randomly selected arbiter key. The dispute arbitration model must be reconciled with the on-chain spend conditions before production.

### 3. Database security cannot be fully verified from this repository

No SQL migrations/schema for the relevant tables, row-level security policies, or RPC function definitions were found in the repository tree. The authorization and atomicity of functions such as order state transitions, dispute decisions, escrow setup, release, and refund therefore remain unverified. Export and audit the actual Supabase schema and policies before production.

### 4. Removing secrets from the current tree does not erase Git history

The files have been removed from the current branch tree, but their old commits remain in the public repository history. When the test phase is complete, rotate/revoke exposed credentials and consider a coordinated history rewrite if historical secret material must be removed. Rewriting history changes commit IDs and affects every clone.

### 5. End-to-end Bitcoin tests still require a node

CI validates installation, lint, TypeScript, build, and production dependency audit. It does not have access to the developer's local Bitcoin Core regtest/signet node or a live Supabase test project, so transaction broadcast, confirmation, dispute, refund, and recovery flows still require end-to-end testing against isolated test infrastructure.

## Release gate

- [ ] Rotate/revoke exposed Supabase credentials and verify the old credential no longer works.
- [ ] Review and test the actual Supabase RLS policies and RPC functions.
- [ ] Redesign the escrow so the marketplace does not hold a private signing key and the arbiter's authority is reflected correctly in the spend policy.
- [ ] Run end-to-end regtest tests for funding, release, refund, dispute outcomes, timelocks, malformed PSBTs, duplicate submissions, and restart/recovery.
- [ ] Review dependency audit output and repeat all CI checks on the final release commit.
