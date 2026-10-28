# Supabase schema handoff for escrow audit

Status: preparation checklist only. This file does not certify the current database or its permissions.

## Why this is required

The application calls privileged Supabase operations, but the repository does not currently contain the live project's SQL schema, migrations, Row Level Security (RLS) policies, grants, or function bodies. The non-custodial escrow redesign must not be wired into an assumed schema: authorization and order-state changes need to be enforced atomically by the database as well as by the API.

## Objects already observed in application code

These are names seen in the current application code, not a claim that every object exists or is correctly secured.

### Tables

- `orders`: buyer/seller ownership, order status, escrow index/address/descriptor, funding outpoint, release/refund txids, and order amounts.
- `profiles`: user wallet xpubs.
- `psbts`: order-linked PSBT, purpose, signer metadata, status, txid, creation time.
- `order_events`: event type and data used when determining refund reason.

### RPC functions called from the application

- `set_order_escrow`
- `mark_order_released`
- `mark_order_refunded`

Search the full project and live schema for all other RPC functions, triggers, policies, grants, and views that can change these tables or order/dispute state. In particular, include dispute-opening/decision functions and any order completion, funding, shipping, or delivery transitions.

## Export the schema safely

Use the Supabase CLI against the intended **development/test** project, not production, if possible. The CLI must already be authenticated and linked to the correct project.

Example export:

```powershell
supabase db dump --linked --schema public -f supabase-schema.sql
```

If the CLI reports that additional database tools or permissions are required, follow its diagnostic and export the schema through the project's SQL tooling instead. Export the definitions needed for security review: tables and columns, constraints/indexes, RLS enablement and policies, grants, functions/RPC bodies, triggers, views, and enums. If the dump command omits policies or function definitions, export those separately; do not assume they are included.

Before sharing an export:
- Inspect it for credentials, connection strings, personal data, seed data, and private key material; remove those.
- Do **not** send `.env` files, API keys, service-role/secret keys, database passwords, wallet seeds, mnemonics, xprvs, or private keys.
- Schema names, SQL function bodies, table definitions, policies, and grants are the relevant inputs; production records are not needed.
- Confirm the export is from the same project/environment that the app is currently using.

## Required review before implementing the new escrow

For every security-sensitive table and RPC, verify:

1. RLS is enabled where client access is possible; policies restrict rows by `auth.uid()` and order/dispute membership.
2. Privileged functions validate caller identity and buyer/seller/arbiter role internally; a client-side check is not authorization.
3. Order state changes use transaction-safe preconditions / compare-and-set semantics and cannot be replayed or applied twice.
4. Escrow key assignment, descriptor/address, derivation index, expected amount, and arbiter identity are bound immutably before the funding address is returned.
5. Only public keys and unsigned/partially signed PSBTs are persisted by the service; the server never holds an escrow signing key.
6. Release/refund broadcasting and database state updates can be reconciled safely if the node broadcasts successfully but a database call fails.
7. Database constraints prevent conflicting release and refund records or duplicate active PSBTs for the same order/purpose where appropriate.

## Next implementation gate

Once the schema and function definitions are available, map each API call to its database authorization rule, then create versioned migrations and tests on the security branch. Do not modify production tables or deploy migrations as part of this audit. Keep the pull request in draft and keep using test funds only until the on-chain policy, database authorization, and end-to-end regtest cases pass.
