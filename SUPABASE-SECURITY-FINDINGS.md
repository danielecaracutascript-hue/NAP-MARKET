# Supabase Security Review — Findings and Remediation Plan

Status: review based on the SQL metadata and function definitions exported on 2026-10-28. This document is an audit record, not a migration. Do not treat these findings as proof that every endpoint is exploitable; verify the live grants, callers, and deployment configuration before applying changes.

## Critical / high priority

### 1. `confirm_delivery` does not authorize the caller
The supplied definition selects an order in `SHIPPED` state and updates it to `DELIVERED`, but does not constrain the order to `buyer_id = auth.uid()` or explicitly require a non-null authenticated identity. The function is executable by `PUBLIC`, `anon`, and `authenticated`.

Remediation:
- Require `auth.uid() IS NOT NULL`.
- Select the order with `buyer_id = auth.uid()` and `status = 'SHIPPED'` under `FOR UPDATE`.
- Revoke execution from `PUBLIC` and `anon`; grant only to `authenticated` if the client is meant to call it.
- Add regression tests: anonymous caller, unrelated user, seller caller, and valid buyer.

### 2. `confirm_payment` trusts caller-supplied payment facts
The supplied function accepts txid, vout, escrow value and shipping txid, then marks the order funded. The definition shown does not independently validate the transaction, destination script/address, output value, confirmation depth, or relationship to the order. Execution is granted to `PUBLIC`, `anon`, and `authenticated`.

Remediation:
- Do not expose this RPC to browser clients or anonymous callers.
- Revoke execution from `PUBLIC`, `anon`, and `authenticated`; grant only to the trusted backend role if that backend is responsible for verified chain observations.
- Backend must verify the on-chain transaction and exact expected outputs before calling a narrowly scoped state-transition function.
- Use idempotency and uniqueness constraints for outpoints/txids; prevent a transaction from funding multiple orders.
- Do not rely on a client-provided amount or txid as proof of payment.

### 3. Address field appears not to be encrypted
The supplied `save_address` definition inserts `convert_to(trim(p_text), 'UTF8')` into `addresses.encrypted_payload`. That converts plaintext text to bytes; it is not encryption. `my_addresses` converts the stored bytes back to UTF-8 and returns the plaintext.

Remediation:
- Treat this as plaintext personal data until proven otherwise.
- Decide where encryption occurs and document the threat model. Prefer authenticated client-side encryption if the server must not read addresses; otherwise use a vetted encryption service/key-management design and avoid describing simple byte conversion as encryption.
- Review backups, logs, service-role access, retention, deletion, and incident obligations before real users are onboarded.
- Do not change existing rows or encryption semantics without a deliberate migration and recovery plan.

### 4. Escrow key policy does not yet meet the stated non-custodial design
The current application design has been documented as using a platform mnemonic for signing and a descriptor without a distinct per-order arbiter key. Database state transitions such as `decide_dispute` do not by themselves enforce Bitcoin spending authority.

Remediation:
- Implement a real 2-of-3 script policy with buyer, seller, and assigned arbiter public keys fixed before the funding address is shown.
- The marketplace must not possess any private key capable of unilateral spending.
- Store immutable descriptor/script/address/key fingerprints and expected outputs per order.
- Test every permitted key pair and prove that no single key, including any platform key, can spend early or unilaterally.

## High priority

### 5. SECURITY DEFINER functions need a systematic review
Some supplied functions set `search_path = public`, while others (including `confirm_delivery`, `confirm_payment`, `simulate_payment`, and `simulate_delivery`) do not. A fixed search path is an important hardening measure for SECURITY DEFINER routines.

Remediation:
- Review every SECURITY DEFINER function, set a safe fixed search path (normally `pg_catalog, public` with schema-qualified references where practical), and revoke unnecessary execution grants.
- Audit ownership and grants for every referenced table/function.
- Keep authorization checks inside each SECURITY DEFINER function; RLS alone is not a substitute.

### 6. Payment and escrow RPC grants are broader than necessary
The supplied privilege listing shows several sensitive functions executable by `PUBLIC` and/or `anon`, including `confirm_payment` and `confirm_delivery`. `is_arbiter_of_order` and `is_arbiter_of_listing` are also callable publicly, which may be acceptable only if their output does not disclose sensitive information and their implementation remains safe.

Remediation:
- Create an explicit allowlist of RPCs callable by `anon`, `authenticated`, and `service_role`.
- Revoke default `PUBLIC` execution for all application RPCs, then grant only the minimum needed.
- Verify effective privileges after migration, not just the intended SQL.
- Test calls through the actual Supabase API using anon, authenticated non-party, buyer, seller, arbiter, and service-role contexts.

### 7. RLS is enabled but not forced
The supplied metadata shows RLS enabled and not forced on every listed table. Table owners and roles with bypass privileges can bypass ordinary RLS; this is not automatically a vulnerability, but it means the table policies alone do not establish the full access boundary.

Remediation:
- Review table ownership and every API-facing role.
- For tables where appropriate, evaluate `FORCE ROW LEVEL SECURITY`; check the impact on SECURITY DEFINER routines, migrations, and service-role workflows before applying.
- Confirm that no direct INSERT/UPDATE/DELETE grants bypass intended RPC-only write paths.

### 8. Evidence INSERT policy does not validate dispute membership
The supplied `parties upload evidence` policy checks only `uploader_id = auth.uid()`. The shown policy does not prove that the uploader is a party to the dispute or its assigned arbiter. A foreign key ensures that the uploader profile exists, not that the user may upload to that dispute.

Remediation:
- Add a dispute/order membership check to the INSERT policy or route all evidence creation through a carefully authorized RPC.
- Validate allowed evidence metadata and object-storage paths; apply storage policies to uploaded files too.
- Test attempts to attach evidence to another user's dispute.

## Product-rule / correctness mismatches

### 9. Delivery and return windows conflict with the intended 30-day rule
The supplied `confirm_delivery`, `simulate_delivery`, and `request_return` definitions use a 14-day window, while the product requirement is 30 days. `open_dispute` also contains a 14-day-oriented error message.

Remediation:
- Define one source of truth for the 30-day return/dispute window.
- Update all relevant production and test functions together, with migration tests and UI text.
- Confirm whether the return shipping deadline remains 7 days after return approval.

### 10. Commission presentation and calculation need a single specification
The supplied `quote_order` computes a 4% buyer fee and stores a seller commission of the same amount. The product rule is an 8% total buyer/seller protection fee split between the two sides. Confirm whether each side pays 4% and whether the buyer-facing total includes only the buyer's portion. Verify that the escrow amount, seller payout, refund amount, shipping funds, and UI labels all use the same formula.

### 11. Disputes can be left without an assigned arbiter
The supplied `open_dispute` allows `arbiter_id` to remain null and sets the dispute status to `open`, while changing the order to `DISPUTED`. Confirm that a supported reassignment/escalation process exists and cannot leave orders indefinitely locked. For the on-chain design, the arbiter key must already be fixed before funding; an arbiter selected only after a dispute cannot be inserted into an already-funded script.

## Required verification before applying a production migration

1. Export complete table definitions, indexes, constraints, grants, RLS policies, triggers, function definitions, and function ownership from the live Supabase project.
2. Search application/API callers for each RPC and classify the expected caller role.
3. Write a migration with explicit revokes/grants and authorization fixes; test it against a disposable Supabase project first.
4. Add negative authorization tests and state-transition/idempotency tests.
5. Verify no real funds are used until the on-chain escrow redesign is implemented and independently reviewed.

## Scope limitations
This review is based on the supplied query output, not direct execution against the live database. It does not prove exploitability of every finding, and it is not a substitute for a full security audit. No database changes have been applied by this document.
