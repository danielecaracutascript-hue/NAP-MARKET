# Supabase security audit export guide

This repository currently does not contain the live database schema, RLS policies, or RPC definitions needed to verify authorization and atomic order transitions. Export these from the **development/test Supabase project** before implementing the escrow redesign.

Do not include API keys, access tokens, passwords, wallet seeds, mnemonics, xprvs, or customer data in the export. Save only DDL/metadata and redact project-specific identifiers if sharing publicly.

## Where to run the queries

Open Supabase Dashboard → SQL Editor for the development/test project. Run each query and save the result as CSV or copy the SQL output into a local file. These are read-only metadata queries.

### 1. Tables, columns, types, defaults, and nullability

```sql
select
  table_schema,
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;
```

### 2. Primary keys, foreign keys, unique constraints, and checks

```sql
select
  tc.table_schema,
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name as referenced_table,
  ccu.column_name as referenced_column,
  cc.check_clause
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu
  on tc.constraint_schema = kcu.constraint_schema
 and tc.constraint_name = kcu.constraint_name
 and tc.table_name = kcu.table_name
left join information_schema.constraint_column_usage ccu
  on tc.constraint_schema = ccu.constraint_schema
 and tc.constraint_name = ccu.constraint_name
left join information_schema.check_constraints cc
  on tc.constraint_schema = cc.constraint_schema
 and tc.constraint_name = cc.constraint_name
where tc.table_schema = 'public'
order by tc.table_name, tc.constraint_name, kcu.ordinal_position;
```

### 3. RLS enabled/forced state

```sql
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
order by c.relname;
```

### 4. RLS policies

```sql
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

### 5. Public-schema functions and full definitions

```sql
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as result_type,
  p.prosecdef as security_definer,
  p.provolatile as volatility,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname, pg_get_function_identity_arguments(p.oid);
```

Review every `SECURITY DEFINER` function carefully. Confirm its owner, fixed `search_path`, explicit authorization checks, transaction behavior, and execute grants. Do not publish a raw export if any function body contains credentials or personal data.

### 6. Grants on tables, sequences, and functions

```sql
select
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
order by table_name, grantee, privilege_type;

select
  routine_schema,
  routine_name,
  grantee,
  privilege_type
from information_schema.role_routine_grants
where routine_schema = 'public'
order by routine_name, grantee, privilege_type;
```

### 7. Triggers

```sql
select
  event_object_table as table_name,
  trigger_name,
  action_timing,
  event_manipulation,
  action_statement
from information_schema.triggers
where trigger_schema = 'public'
order by event_object_table, trigger_name;
```

## What must be checked before code changes

- Order status transitions are atomic and reject invalid/repeated transitions.
- Every privileged RPC checks the caller's identity and relationship to the order/dispute; client-side checks are not authorization.
- Buyer, seller, arbiter assignment, descriptor, derivation index, funding address, and expected amounts become immutable once the escrow address is exposed/funded.
- A dispute decision in the database never substitutes for the required on-chain signatures.
- Release/refund cannot race; a transaction broadcast followed by a database failure can be reconciled safely.
- RLS denies unauthorized reads/writes and service-role access is restricted to server-only code.
- No function accepts a caller-supplied user ID as proof of identity without validating it against `auth.uid()`.

## What to send back for review

Share the sanitized metadata outputs (sections 1–7) or commit the schema and migrations from the test project into a dedicated branch. Do not send secrets or production customer records. With the actual definitions available, the next change can be a real migration and tests rather than guessed SQL.
