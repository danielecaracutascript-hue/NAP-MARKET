-- Escrow v2 staging: protect against blank identifiers and unsupported networks.
-- Requires the escrow_v2_require_inputs function from the previous migration.
create or replace function public.escrow_v2_require_inputs(
  p_order uuid, p_buyer uuid, p_seller uuid, p_arbiter uuid,
  p_index integer, p_network text, p_descriptor text, p_address text,
  p_buyer_xpub text, p_seller_xpub text, p_arbiter_xpub text
)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if p_order is null or p_buyer is null or p_seller is null
     or p_arbiter is null or p_index is null or p_network is null
     or nullif(btrim(p_descriptor), '') is null
     or nullif(btrim(p_address), '') is null
     or nullif(btrim(p_buyer_xpub), '') is null
     or nullif(btrim(p_seller_xpub), '') is null
     or nullif(btrim(p_arbiter_xpub), '') is null then
    raise exception 'Missing escrow v2 assignment input';
  end if;
  if p_index < 0 or p_network not in ('regtest', 'signet') then
    raise exception 'Invalid escrow v2 network or derivation index';
  end if;
  if p_buyer = p_seller or p_buyer = p_arbiter or p_seller = p_arbiter then
    raise exception 'Escrow v2 participants must be distinct';
  end if;
end;
$$;
