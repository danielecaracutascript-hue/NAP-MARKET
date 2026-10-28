-- Staging-only atomic escrow v2 assignment.
-- Only a privileged backend may execute this function.
-- Bitcoin Core descriptor/address validation MUST happen before this call.
create or replace function public.assign_escrow_v2(
  p_order uuid,
  p_buyer uuid,
  p_seller uuid,
  p_arbiter uuid,
  p_buyer_xpub text,
  p_seller_xpub text,
  p_arbiter_xpub text,
  p_index integer,
  p_network text,
  p_descriptor text,
  p_address text
)
returns public.escrow_v2_assignments
language plpgsql
security invoker
set search_path = public
as $$
declare
  o public.orders%rowtype;
  assignment public.escrow_v2_assignments%rowtype;
begin
  perform public.escrow_v2_require_inputs(p_order, p_buyer, p_seller, p_arbiter, p_index, p_network, p_descriptor, p_address);
  select * into o from public.orders where id = p_order for update;
  if not found then
    raise exception 'Order not found';
  end if;

  select * into assignment
    from public.escrow_v2_assignments where order_id = p_order;
  if found then
    if assignment.buyer_id is distinct from p_buyer
       or assignment.seller_id is distinct from p_seller
       or assignment.arbiter_id is distinct from p_arbiter
       or assignment.derivation_index is distinct from p_index
       or assignment.network is distinct from p_network
       or assignment.descriptor is distinct from p_descriptor
       or assignment.escrow_address is distinct from p_address
       or assignment.buyer_xpub is distinct from p_buyer_xpub
       or assignment.seller_xpub is distinct from p_seller_xpub
       or assignment.arbiter_xpub is distinct from p_arbiter_xpub then
      raise exception 'Existing escrow assignment differs';
    end if;
    return assignment;
  end if;

  if o.status <> 'CREATED' or o.escrow_address is not null
     or o.buyer_id is distinct from p_buyer
     or o.seller_id is distinct from p_seller
     or o.escrow_index is distinct from p_index then
    raise exception 'Order is not eligible for escrow v2 assignment';
  end if;

  insert into public.escrow_v2_assignments (
    order_id, buyer_id, seller_id, arbiter_id,
    buyer_xpub, seller_xpub, arbiter_xpub,
    derivation_index, network, descriptor, escrow_address
  ) values (
    p_order, p_buyer, p_seller, p_arbiter,
    p_buyer_xpub, p_seller_xpub, p_arbiter_xpub,
    p_index, p_network, p_descriptor, p_address
  ) returning * into assignment;

  return assignment;
end;
$$;

revoke all on function public.assign_escrow_v2(
  uuid, uuid, uuid, uuid, text, text, text, integer, text, text, text
) from public, anon, authenticated;
