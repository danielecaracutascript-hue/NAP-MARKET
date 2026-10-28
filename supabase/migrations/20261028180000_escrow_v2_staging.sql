-- Escrow v2 staging schema; apply only to a development database after review.
-- Existing orders and escrow flows are not modified.
create table if not exists public.escrow_v2_assignments (
  order_id uuid primary key references public.orders(id) on delete restrict,
  buyer_id uuid not null,
  seller_id uuid not null,
  arbiter_id uuid not null,
  buyer_xpub text not null,
  seller_xpub text not null,
  arbiter_xpub text not null,
  derivation_index integer not null check (derivation_index >= 0),
  network text not null check (network in ('regtest', 'signet')),
  descriptor text not null,
  escrow_address text not null,
  created_at timestamptz not null default now(),
  constraint escrow_v2_distinct_participants check (
    buyer_id <> seller_id and buyer_id <> arbiter_id and seller_id <> arbiter_id
  ),
  constraint escrow_v2_distinct_keys check (
    buyer_xpub <> seller_xpub and buyer_xpub <> arbiter_xpub and seller_xpub <> arbiter_xpub
  )
);
create unique index if not exists escrow_v2_unique_address
  on public.escrow_v2_assignments(network, escrow_address);
alter table public.escrow_v2_assignments enable row level security;
revoke all on public.escrow_v2_assignments from public, anon, authenticated;
