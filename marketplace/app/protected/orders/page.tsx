import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Row = {
  id: string;
  status: string;
  price_eur_cents: number;
  created_at: string;
  buyer_id: string;
  seller_id: string;
  listings: { title: string } | null;
};

async function OrdersList() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  const { data, error } = await supabase
    .from("orders")
    .select("id, status, price_eur_cents, created_at, buyer_id, seller_id, listings(title)")
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      {error && <p className="text-sm">Error: {error.message}</p>}
      {rows.length === 0 && !error && <p className="text-sm">No orders yet.</p>}
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="rounded border p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Link className="font-semibold underline" href={"/protected/orders/" + r.id}>
                  {r.listings?.title ?? "Listing"}
                </Link>
                <p className="text-sm opacity-70">
                  {r.buyer_id === me ? "You are buying" : "You are selling"} · {new Date(r.created_at).toLocaleDateString("en-GB")}
                </p>
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold">{(r.price_eur_cents / 100).toFixed(2)} EUR</p>
                <p className="opacity-70">{r.status}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function OrdersPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My orders</h1>
        <Link className="text-sm underline" href="/protected/listings">Listings</Link>
      </div>
      <Suspense fallback={<p className="text-sm">Loading orders...</p>}>
        <OrdersList />
      </Suspense>
    </div>
  );
}
