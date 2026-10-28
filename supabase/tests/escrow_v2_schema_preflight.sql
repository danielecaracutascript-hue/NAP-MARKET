-- Staging schema preflight. Run read-only in Supabase SQL Editor before applying
-- escrow v2 migrations. Review output; do not paste secrets or private keys.
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('orders', 'arbiters', 'profiles', 'escrow_v2_assignments')
  and column_name in (
    'id', 'buyer_id', 'seller_id', 'arbiter_id', 'status', 'escrow_index',
    'escrow_address', 'wallet_xpub', 'active', 'is_active', 'available',
    'user_id', 'shipping_address', 'escrow_descriptor'
  )
order by table_name, ordinal_position;

select p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('set_order_escrow', 'assign_escrow_v2')
order by p.proname;

select conrelid::regclass::text as relation_name, conname,
       pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in ('public.orders'::regclass, 'public.arbiters'::regclass)
order by relation_name, conname;
