"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Dispute = {
  id: string;
  reason: string;
  description: string;
  status: string;
  decision: string | null;
  decision_notes: string | null;
  opened_by: string;
  opened_at: string;
  orders: {
    id: string;
    buyer_id: string;
    seller_id: string;
    price_eur_cents: number;
    listings: { title: string } | null;
  } | null;
};

type Profile = {
  id: string;
  email: string;
};

type Ev = { type: string; actor_role: string; created_at: string; data?: any };

export default function ArbiterClient({ disputeId }: { disputeId: string }) {
  const supabase = createClient();
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [events, setEvents] = useState<Ev[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [decision, setDecision] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    const { data: d } = await supabase
      .from("disputes")
      .select("*, orders(id, buyer_id, seller_id, price_eur_cents, listings(title))")
      .eq("id", disputeId)
      .maybeSingle();
    setDispute(d as Dispute | null);

    if (d?.orders) {
      const userIds = [d.orders.buyer_id, d.orders.seller_id];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", userIds);
      const profMap = (profs ?? []).reduce((acc, p) => {
        acc[p.id] = p as Profile;
        return acc;
      }, {} as Record<string, Profile>);
      setProfiles(profMap);
    }

    const { data: ev } = await supabase
      .from("order_events")
      .select("type, actor_role, created_at, data")
      .eq("order_id", d?.orders?.id ?? "")
      .order("created_at");
    setEvents((ev ?? []) as Ev[]);

    setLoaded(true);
  }

  useEffect(() => {
    load();
  }, []);

  async function submitDecision(e: FormEvent) {
    e.preventDefault();
    if (!dispute) return;
    setSubmitting(true);
    setMessage("");
    try {
      const { error } = await supabase.rpc("decide_dispute", {
        p_dispute: disputeId,
        p_decision: decision,
        p_notes: notes.trim() || null,
      });
      if (error) throw new Error(error.message);
      setMessage("Decision recorded. The appropriate refund will be processed.");
      await load();
    } catch (err) {
      setMessage("Error: " + (err as Error).message);
    }
    setSubmitting(false);
  }

  if (!loaded) return <p className="p-6 text-sm">Loading...</p>;
  if (!dispute) return <p className="p-6 text-sm">Dispute not found.</p>;

  const order = dispute.orders;
  const buyer = order ? profiles[order.buyer_id] : null;
  const seller = order ? profiles[order.seller_id] : null;
  const field = "w-full rounded border bg-transparent px-3 py-2";
  const btn = "rounded bg-foreground px-4 py-2 text-background";
  const btnOutline = "rounded border px-4 py-2";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-6">
      <p className="text-sm">
        <Link className="underline" href="/protected/arbiter">Back to cases</Link>
      </p>
      <h1 className="text-2xl font-bold">Dispute #{dispute.id.slice(0, 8)}</h1>

      <div className="rounded border p-4 text-sm">
        <div className="flex justify-between font-semibold">
          <span>Order: {order?.listings?.title ?? "Unknown"}</span>
          <span>{order ? (order.price_eur_cents / 100).toFixed(2) + " EUR" : ""}</span>
        </div>
        <p className="opacity-70">Reason: {dispute.reason.split("_").join(" ")}</p>
        <p className="opacity-70">Status: {dispute.status}</p>
        <p className="opacity-70">Opened: {new Date(dispute.opened_at).toLocaleString()}</p>
      </div>

      <div className="rounded border p-4 text-sm">
        <p className="font-semibold">Description</p>
        <p className="whitespace-pre-wrap">{dispute.description}</p>
      </div>

      {order && (
        <div className="rounded border p-4 text-sm">
          <p className="font-semibold">Parties</p>
          <p>Buyer: {buyer?.email ?? "Unknown"}</p>
          <p>Seller: {seller?.email ?? "Unknown"}</p>
        </div>
      )}

      <div className="rounded border p-4 text-sm">
        <p className="font-semibold">Order History</p>
        <ul className="space-y-1 text-xs opacity-70">
          {events.map((ev, i) => (
            <li key={i}>
              {new Date(ev.created_at).toLocaleString()} - {ev.type} ({ev.actor_role})
            </li>
          ))}
        </ul>
      </div>

      {dispute.status === "assigned" && (
        <form onSubmit={submitDecision} className="space-y-3 rounded border p-4 text-sm">
          <p className="font-semibold">Your decision</p>
          <p className="text-xs opacity-70">
            Review the evidence and decide in favor of the buyer or seller.
            The losing party pays a 5 EUR dispute fee.
          </p>
          <select className={field} value={decision} onChange={(e) => setDecision(e.target.value)} required>
            <option value="">Select decision...</option>
            <option value="buyer">In favor of buyer (refund)</option>
            <option value="seller">In favor of seller (release to seller)</option>
          </select>
          <textarea
            className={field}
            rows={4}
            placeholder="Explain your decision (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <button type="submit" disabled={submitting} className={btn}>
            {submitting ? "Submitting..." : "Submit decision"}
          </button>
        </form>
      )}

      {dispute.status === "decided" && (
        <div className="rounded border p-4 text-sm">
          <p className="font-semibold">Decision: {dispute.decision}</p>
          {dispute.decision_notes && <p className="whitespace-pre-wrap">{dispute.decision_notes}</p>}
        </div>
      )}

      {message && <p className="text-sm">{message}</p>}
    </div>
  );
}
