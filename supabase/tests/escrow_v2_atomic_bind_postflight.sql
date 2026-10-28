-- Read-only checks to run AFTER applying the escrow v2 staging migrations.
-- No order data is created or changed by this script.
select p.proname, p.prosecdef as security_definer,
       p.proowner::regrole::text as owner_role
from pg_proc p
where p.oid = 'public.assign_escrow_v2(uuid,uuid,uuid,uuid,text,text,text,integer,text,text,text)'::regprocedure;

select r.rolname as role_name,
       has_function_privilege(
         r.oid,
         'public.assign_escrow_v2(uuid,uuid,uuid,uuid,text,text,text,integer,text,text,text)',
         'EXECUTE'
       ) as can_execute
from pg_roles r
where r.rolname in ('anon','authenticated','service_role','postgres')
order by r.rolname;

select t.tgname as trigger_name, t.tgenabled as enabled
from pg_trigger t
where t.tgrelid in ('public.orders'::regclass, 'public.escrow_v2_assignments'::regclass)
  and not t.tgisinternal
  and t.tgname like 'escrow_v2%'
order by t.tgname;

select count(*) as staged_assignments,
       count(*) filter (where o.escrow_address is distinct from a.escrow_address
                         or o.escrow_descriptor is distinct from a.descriptor)
         as mismatched_orders
from public.escrow_v2_assignments a
join public.orders o on o.id = a.order_id;
