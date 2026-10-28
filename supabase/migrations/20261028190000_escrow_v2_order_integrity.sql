-- Staging-only integrity gate for escrow v2 assignments.
-- This migration does not enable any endpoint or alter legacy order funding.
-- Requires orders(id,buyer_id,seller_id,status,escrow_index,escrow_address).
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
     or current_order.escrow_address is not null then
    raise exception 'Escrow v2 assignment requires an unfunded, unassigned CREATED order';
  end if;

  if current_order.buyer_id is distinct from new.buyer_id
     or current_order.seller_id is distinct from new.seller_id then
    raise exception 'Escrow v2 participants do not match the order';
  end if;

  if current_order.escrow_index is distinct from new.derivation_index then
    raise exception 'Escrow v2 derivation index does not match the order';
  end if;

  return new;
end;
$$;

drop trigger if exists escrow_v2_assignment_validate
  on public.escrow_v2_assignments;

create trigger escrow_v2_assignment_validate
before insert on public.escrow_v2_assignments
for each row execute function public.escrow_v2_validate_assignment();

revoke all on function public.escrow_v2_validate_assignment()
  from public, anon, authenticated;
