import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rpc } from "@/lib/bitcoin";

type Utxo = { txid: string; vout: number; amount: number; confirmations: number };

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { data: o } = await supabase
      .from("orders")
      .select("id, buyer_id, seller_id, status, price_sats, buyer_commission_sats, shipping_sats, escrow_address, shipping_address, expires_at")
      .eq("id", id)
      .maybeSingle();
    if (!o || (o.buyer_id !== auth.user.id && o.seller_id !== auth.user.id)) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (o.status !== "CREATED") {
      return NextResponse.json({ ok: true, message: "Order status: " + o.status });
    }
    if (!o.escrow_address || !o.shipping_address) {
      return NextResponse.json({ error: "Payment details have not been created yet" }, { status: 400 });
    }

    const priceSats = Number(o.price_sats);
    const buyerCommissionSats = Number(o.buyer_commission_sats);
    const shippingSats = Number(o.shipping_sats);
    const needEscrow = priceSats + buyerCommissionSats;
    if (
      !Number.isSafeInteger(priceSats) ||
      !Number.isSafeInteger(buyerCommissionSats) ||
      !Number.isSafeInteger(shippingSats) ||
      priceSats <= 0 ||
      buyerCommissionSats < 0 ||
      shippingSats < 0 ||
      !Number.isSafeInteger(needEscrow) ||
      needEscrow <= 0
    ) {
      return NextResponse.json({ error: "Invalid order amounts" }, { status: 400 });
    }
    const utxos = await rpc<Utxo[]>("listunspent", [1, 9999999, [o.escrow_address]], "escrow1");
    if (!utxos || !Array.isArray(utxos)) {
      return NextResponse.json({ ok: true, message: "Escrow payment not confirmed yet" });
    }

    // Never pick an arbitrary UTXO or silently accept an overpayment: the exact
    // funding outpoint must be unambiguous before binding it to the order.
    const toSats = (btc: number) => Math.round(btc * 100_000_000);
    const exactMatches = utxos.filter((x) => toSats(x.amount) === needEscrow);
    const largerMatches = utxos.filter((x) => toSats(x.amount) > needEscrow);
    if (exactMatches.length > 1 || largerMatches.length > 0) {
      return NextResponse.json({
        ok: true,
        message: "Payment amount is ambiguous or exceeds the order amount. Manual review is required.",
      });
    }
    const u = exactMatches[0];
    const received = await rpc<number>("getreceivedbyaddress", [o.shipping_address, 1], "shipping");
    const gotShipping = toSats(received);

    if (!u) return NextResponse.json({ ok: true, message: "Escrow payment not confirmed yet" });
    if (gotShipping < shippingSats) {
      return NextResponse.json({ ok: true, message: "Escrow paid. Shipping payment not confirmed yet" });
    }
    if (new Date(o.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ ok: true, message: "The order expired before the payment was confirmed. Late payments need manual review." });
    }

    const tip = await rpc<number>("getblockcount");
    const height = tip - u.confirmations + 1;
    const admin = createAdminClient();
    const { error } = await admin.rpc("mark_order_funded", {
      p_order: id,
      p_txid: u.txid,
      p_vout: u.vout,
      p_height: height,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, message: "Payment confirmed" });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
