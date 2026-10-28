-- Harden direct inserts as well as calls through assign_escrow_v2.
-- Staging only; does not activate the payment flow.
alter table public.escrow_v2_assignments
  add constraint escrow_v2_nonempty_keys check (
    length(btrim(buyer_xpub)) > 0 and
    length(btrim(seller_xpub)) > 0 and
    length(btrim(arbiter_xpub)) > 0
  ),
  add constraint escrow_v2_nonempty_descriptor_address check (
    length(btrim(descriptor)) > 0 and
    length(btrim(escrow_address)) > 0
  ),
  add constraint escrow_v2_trimmed_distinct_keys check (
    btrim(buyer_xpub) <> btrim(seller_xpub) and
    btrim(buyer_xpub) <> btrim(arbiter_xpub) and
    btrim(seller_xpub) <> btrim(arbiter_xpub)
  );
