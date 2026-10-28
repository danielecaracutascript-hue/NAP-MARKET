-- Escrow v2 staging: reserve and bind the address in one transaction.
-- No HTTP route invokes this function yet. Existing funded orders are untouched.
create or replace function public.escrow_v2_block_legacy_collision()
returns trigger language plpgsql security invoker set search_path = public as $$
declare
  a public.escrow_v2_assignments%rowtype;
begin
  if old.escrow_address is null and new.escrow_address is not null then
    select * into a from public.escrow_v2_assignments
      where order_id = new.id;
    if found and (
      new.escrow_address is distinct from a.escrow_address
      or new.escrow_descriptor is distinct from a.descriptor
    ) then
      raise exception 'Escrow address or descriptor differs from reserved v2 assignment';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.assign_escrow_v2(
  p_order uuid, p_buyer uuid, p_seller uuid, p_arbiter uuid,
  p_buyer_xpub text, p_seller_xpub text, p_arbiter_xpub text,
  p_index integer, p_network text, p_descriptor text, p_address text
)
returns public.escrow_v2_assignments
language plpgsql security invoker set search_path = public as $$
declare
  o public.orders%rowtype;
  a public.escrow_v2_assignments%rowtype;
begin
  perform public.escrow_v2_require_inputs(
    p_order, p_buyer, p_seller, p_arbiter, p_index,
    p_network, p_descriptor, p_address,
    p_buyer_xpub, p_seller_xpub, p_arbiter_xpub
  );
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found'; end if;

  select * into a from public.escrow_v2_assignments where order_id = p_order;
  if found then
    if a.buyer_id is distinct from p_buyer
       or a.seller_id is distinct from p_seller
       or a.arbiter_id is distinct from p_arbiter
       or a.buyer_xpub is distinct from p_buyer_xpub
       or a.seller_xpub is distinct from p_seller_xpub
       or a.arbiter_xpub is distinct from p_arbiter_xpub
       or a.derivation_index is distinct from p_index
       or a.network is distinct from p_network
       or a.descriptor is distinct from p_descriptor
       or a.escrow_address is distinct from p_address
       or o.escrow_descriptor is distinct from a.descriptor
       or o.escrow_address is distinct from a.escrow_address then
      raise exception 'Existing escrow v2 assignment differs from order';
    end if;
    return a;
  end if;

  if o.status <> 'CREATED' or o.escrow_address is not null
     or o.escrow_descriptor is not null
     or o.buyer_id is distinct from p_buyer
     or o.seller_id is distinct from p_seller
     or o.escrow_index is distinct from p_index then
    raise exception 'Order is not eligible for escrow v2 assignment';
  end if;

  if not exists (
    select 1 from public.arbiters ar
    join public.profiles pr on pr.id = ar.user_id
    where ar.user_id = p_arbiter and ar.active = true
      and pr.wallet_xpub = p_arbiter_xpub
  ) then
    raise exception 'Arbiter is inactive or public key does not match profile';
  end if;
  if not exists (
    select 1 from public.profiles pr
    where pr.id = p_buyer and pr.wallet_xpub = p_buyer_xpub
  ) or not exists (
    select 1 from public.profiles pr
    where pr.id = p_seller and pr.wallet_xpub = p_seller_xpub
  ) then
    raise exception 'Buyer or seller public key does not match profile';
  end if;

  insert into public.escrow_v2_assignments (
    order_id, buyer_id, seller_id, arbiter_id,
    buyer_xpub, seller_xpub, arbiter_xpub,
    derivation_index, network, descriptor, escrow_address
  ) values (
    p_order, p_buyer, p_seller, p_arbiter,
    p_buyer_xpub, p_seller_xpub, p_arbiter_xpub,
    p_index, p_network, p_descriptor, p_address
  ) returning * into a;

  update public.orders
  set escrow_descriptor = p_descriptor,
      escrow_address = p_address,
      updated_at = now()
  where id = p_order;

  insert into public.order_events (order_id, actor_role, type, data)
  values (
    p_order, 'platform', 'escrow_created',
    jsonb_build_object('address', p_address, 'version', 2)
  );
  return a;
end;
$$;

revoke all on function public.assign_escrow_v2(
  uuid,uuid,uuid,uuid,text,text,text,integer,text,text,text
) from public,anon,authenticated;
