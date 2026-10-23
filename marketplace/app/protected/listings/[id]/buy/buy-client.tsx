"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Address = { id: string; country: string; full_text: string };
type Quote = {
  price_eur_cents: number;
  buyer_fee_eur_cents: number;
  shipping_eur_cents: number;
  total_eur_cents: number;
  btc_eur: number;
  price_sats: number;
  buyer_commission_sats: number;
  shipping_sats: number;
};

const eur = (cents: number) => (cents / 100).toFixed(2) + " EUR";
const btc = (sats: number) => (sats / 1e8).toFixed(8) + " BTC";

export default function BuyClient({ listingId }: { listingId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selected, setSelected] = useState("");
  const [newCountry, setNewCountry] = useState("");
  const [newText, setNewText] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadAddresses(selectId?: string) {
    const { data, error } = await supabase.rpc("my_addresses");
    if (error) {
      setMessage("Error: " + error.message);
      return;
    }
    const list = (data ?? []) as Address[];
    setAddresses(list);
    if (selectId) setSelected(selectId);
    else if (list.length > 0 && !selected) setSelected(list[0].id);
  }

  useEffect(() => {
    loadAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function getQuote() {
      setQuote(null);
      const addr = addresses.find((a) => a.id === selected);
      if (!addr) return;
      setMessage("");
      const { data, error } = await supabase.rpc("quote_order", {
        p_listing: listingId,
        p_dest: addr.country,
      });
      if (error) {
        setMessage("Error: " + error.message);
        return;
      }
      setQuote(data as Quote);
    }
    getQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, addresses]);

  async function saveAddress(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    const { data, error } = await supabase.rpc("save_address", {
      p_country: newCountry,
      p_text: newText,
    });
    if (error) {
      setMessage("Error: " + error.message);
      return;
    }
    setNewCountry("");
    setNewText("");
    await loadAddresses(data as string);
  }

  async function createOrder() {
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.rpc("create_order", {
      p_listing: listingId,
      p_address: selected,
    });
    if (error) {
      setMessage("Error: " + error.message);
      setBusy(false);
      return;
    }
    router.push("/protected/orders/" + (data as string));
  }

  const field = "w-full rounded border bg-transparent px-3 py-2";

  return (
    <div className="mx-auto w-full max-w-md space-y-5 p-6">
      <p className="text-sm">
        <Link className="underline" href={"/protected/listings/" + listingId}>Back to listing</Link>
      </p>
      <h1 className="text-2xl font-bold">Checkout</h1>

      <div className="space-y-2">
        <h2 className="font-semibold">Shipping address</h2>
        {addresses.length > 0 && (
          <select className={field} value={selected} onChange={(e) => setSelected(e.target.value)}>
            {addresses.map((a) => (
              <option key={a.id} value={a.id}>
                {a.country} - {a.full_text.slice(0, 40)}
              </option>
            ))}
          </select>
        )}
        <form onSubmit={saveAddress} className="space-y-2 rounded border p-3">
          <p className="text-sm font-semibold">Add an address</p>
          <p className="text-xs opacity-70">Test mode: addresses are not encrypted yet. Use fake data only.</p>
          <input className={field} placeholder="Country (2 letters, e.g. IT)" value={newCountry}
            onChange={(e) => setNewCountry(e.target.value)} maxLength={2} minLength={2} required />
          <textarea className={field} rows={3} placeholder="Full name and address" value={newText}
            onChange={(e) => setNewText(e.target.value)} required />
          <button type="submit" className="rounded border px-3 py-1 text-sm">Save address</button>
        </form>
      </div>

      {quote && (
        <div className="space-y-1 rounded border p-4 text-sm">
          <div className="flex justify-between"><span>Price</span><span>{eur(quote.price_eur_cents)}</span></div>
          <div className="flex justify-between"><span>Buyer fee (4%)</span><span>{eur(quote.buyer_fee_eur_cents)}</span></div>
          <div className="flex justify-between"><span>Shipping</span><span>{eur(quote.shipping_eur_cents)}</span></div>
          <div className="flex justify-between border-t pt-1 font-semibold"><span>Total</span><span>{eur(quote.total_eur_cents)}</span></div>
          <div className="pt-2 opacity-70">
            <p>Escrow: {btc(quote.price_sats + quote.buyer_commission_sats)}</p>
            <p>Shipping wallet: {btc(quote.shipping_sats)}</p>
            <p>Rate locked when you create the order: 1 BTC = {quote.btc_eur} EUR</p>
          </div>
          <button onClick={createOrder} disabled={busy}
            className="mt-2 rounded bg-foreground px-4 py-2 text-background disabled:opacity-50">
            {busy ? "Creating..." : "Create order"}
          </button>
        </div>
      )}
      {message && <p className="text-sm">{message}</p>}
    </div>
  );
}
