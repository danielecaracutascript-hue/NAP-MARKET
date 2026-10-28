-- Security hardening based on the live Supabase schema exported for review.
-- Apply first to a staging project, then run the authorization regression tests.
-- This migration intentionally does not redesign escrow or alter payment accounting.

begin;

-- confirm_delivery previously selected any SHIPPED order by UUID and did not
-- bind the caller to the buyer. Also align the delivery window with the
-- product rule (30 days). The row lock makes the state transition atomic.
create or replace function public.confirm_delivery(p_order uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  o public.orders%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select *
    into o
    from public.orders
   where id = p_order
     and buyer_id = auth.uid()
     and status = 'SHIPPED'
   for update;

  if not found then
    raise exception 'Order not found, not your order, or not in SHIPPED status';
  end if;

  update public.orders
     set status = 'DELIVERED',
         delivered_at = now(),
         window_ends_at = now() + interval '30 days',
         updated_at = now()
   where id = p_order;

  insert into public.order_events (order_id, actor_id, actor_role, type, data)
  values (p_order, auth.uid(), 'buyer', 'delivered', '{}'::jsonb);
end;
$function$;

-- Only an authenticated buyer should be able to confirm delivery.
revoke all on function public.confirm_delivery(uuid) from public, anon;
grant execute on function public.confirm_delivery(uuid) to authenticated, service_role;

-- Legacy RPC trusts txid/vout/value parameters and can mark an order FUNDED
-- without independently checking Bitcoin. Current app confirmation should go
-- through the server-side Bitcoin Core verifier and mark_order_funded instead.
-- Disable this legacy RPC for all client roles.
revoke all on function public.confirm_payment(uuid, text, integer, bigint, text)
  from public, anon, authenticated;
grant execute on function public.confirm_payment(uuid, text, integer, bigint, text)
  to service_role;

-- Existing INSERT policy only checked uploader_id=auth.uid(), so any signed-in
-- user could attach evidence to an arbitrary dispute UUID. Require the caller
-- to be a party to the order or the assigned arbiter.
drop policy if exists "parties upload evidence" on public.dispute_evidence;
create policy "parties upload evidence"
on public.dispute_evidence
for insert
to authenticated
with check (
  uploader_id = auth.uid()
  and exists (
    select 1
      from public.disputes d
      join public.orders o on o.id = d.order_id
     where d.id = dispute_evidence.dispute_id
       and (
         d.arbiter_id = auth.uid()
         or o.buyer_id = auth.uid()
         or o.seller_id = auth.uid()
       )
  )
);

commit;
