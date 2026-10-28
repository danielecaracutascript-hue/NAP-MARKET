-- Read-only permissions audit. Run in Supabase SQL Editor before
-- applying the legacy escrow RPC privilege migration.
select r.rolname as role_name,
       has_function_privilege(
         r.oid,
         'public.set_order_escrow(uuid,text,text,text)',
         'EXECUTE'
       ) as can_execute
from pg_roles r
where r.rolname in ('anon', 'authenticated', 'service_role', 'postgres')
order by r.rolname;

select p.proname,
       p.prosecdef as security_definer,
       p.proowner::regrole::text as owner_role,
       p.proacl as explicit_privileges
from pg_proc p
where p.oid = 'public.set_order_escrow(uuid,text,text,text)'::regprocedure;
