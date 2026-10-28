-- Reject missing arguments to the staging assignment function.
-- This migration is deliberately not applied to production automatically.
create or replace function public.escrow_v2_require_inputs(
  p_order uuid, p_buyer uuid, p_seller uuid, p_arbiter uuid,
  p_index integer, p_network text, p_descriptor text, p_address text
)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if p_order is null or p_buyer is null or p_seller is null
     or p_arbiter is null or p_index is null or p_network is null
     or p_descriptor is null or p_address is null then
    raise exception 'Missing escrow v2 assignment input';
  end if;
end;
$$;
revoke all on function public.escrow_v2_require_inputs(
  uuid,uuid,uuid,uuid,integer,text,text,text
) from public,anon,authenticated;
