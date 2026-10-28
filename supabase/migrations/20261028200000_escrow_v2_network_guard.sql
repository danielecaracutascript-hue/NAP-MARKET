-- Add a database guard for escrow v2 assignment inserts.
-- Does not activate escrow v2 or modify existing orders.
create or replace function public.escrow_v2_validate_assignment()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  current_order public.orders%rowtype;
begin
  select * into current_order
    from public.orders where id = new.order_id for update;
  if not found then
    raise exception 'Escrow v2 order does not exist';
  end if;
  if current_order.status <> 'CREATED'
     or current_order.escrow_address is not null
     or current_order.buyer_id is distinct from new.buyer_id
     or current_order.seller_id is distinct from new.seller_id
     or current_order.escrow_index is distinct from new.derivation_index then
    raise exception 'Escrow v2 assignment does not match an unassigned order';
  end if;
  if new.network = 'regtest' and new.escrow_address not like 'bcrt1%' then
    raise exception 'Invalid regtest escrow address';
  end if;
  if new.network = 'signet' and new.escrow_address not like 'tb1%' then
    raise exception 'Invalid signet escrow address';
  end if;
  if new.buyer_xpub not like 'tpub%'
     or new.seller_xpub not like 'tpub%'
     or new.arbiter_xpub not like 'tpub%' then
    raise exception 'Escrow v2 requires testnet public keys';
  end if;
  return new;
end;
$$;
