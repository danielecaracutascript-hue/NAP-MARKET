-- Security hardening for order-transition RPCs.
-- Apply only after reviewing the associated application flow.

BEGIN;

-- Delivery confirmation must only be performed by the authenticated buyer.
-- Keep the client RPC available to authenticated users, but remove PUBLIC/anon access.
CREATE OR REPLACE FUNCTION public.confirm_delivery(p_order uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  o public.orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  SELECT *
    INTO o
    FROM public.orders
   WHERE id = p_order
     AND status = 'SHIPPED'
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or not in SHIPPED status';
  END IF;

  IF o.buyer_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the buyer can confirm delivery';
  END IF;

  UPDATE public.orders
     SET status = 'DELIVERED',
         delivered_at = now(),
         window_ends_at = now() + interval '30 days',
         updated_at = now()
   WHERE id = p_order;

  INSERT INTO public.order_events (order_id, actor_id, actor_role, type, data)
  VALUES (p_order, auth.uid(), 'buyer', 'delivered', '{}'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.confirm_delivery(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_delivery(uuid) TO authenticated, service_role;

-- Legacy function accepts payment identifiers supplied by the caller and does
-- not verify an on-chain payment. Do not expose it to browser/client roles.
-- The application server should use mark_order_funded only after its Bitcoin
-- node verification has succeeded.
REVOKE ALL ON FUNCTION public.confirm_payment(uuid, text, integer, bigint, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_payment(uuid, text, integer, bigint, text)
  TO service_role;

COMMIT;
