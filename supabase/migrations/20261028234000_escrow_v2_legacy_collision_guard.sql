-- Staging isolation: never let a legacy escrow address overwrite an order
-- already reserved for a candidate v2 assignment.
-- Does not modify existing funded orders or enable v2 payments.
create or replace function public.escrow_v2_block_legacy_collision()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if old.escrow_address is null
     and new.escrow_address is not null
     and exists (
       select 1 from public.escrow_v2_assignments a
       where a.order_id = new.id
     ) then
    raise exception 'Order reserved for escrow v2; legacy escrow address rejected';
  end if;
  return new;
end;
$$;

drop trigger if exists escrow_v2_block_legacy_collision on public.orders;
create trigger escrow_v2_block_legacy_collision
before update of escrow_address on public.orders
for each row execute function public.escrow_v2_block_legacy_collision();

revoke all on function public.escrow_v2_block_legacy_collision()
  from public, anon, authenticated;
