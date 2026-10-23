import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rpc } from "@/lib/bitcoin";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { data: order } = await supabase
      .from("orders")
      .select("id, buyer_id, status, escrow_address, shipping_address, price_sats, buyer_commission_sats, shipping_sats")
      .eq("id", id)
      .maybeSingle();
    if (!order || order.buyer_id !== auth.user.id) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (order.status !== "CREATED") {
      return NextResponse.json({ error: "Order is not waiting for payment" }, { status: 400 });
    }

    const escrowAmount = (order.price_sats + order.buyer_commission_sats) / 1e8;
    const shippingAmount = order.shipping_sats / 1e8;

    // Paga escrow dal wallet buyer
    const escrowTxid = await rpc<string>("sendtoaddress", [order.escrow_address, escrowAmount], "buyer");

    // Paga shipping dal wallet buyer
    const shippingTxid = await rpc<string>("sendtoaddress", [order.shipping_address, shippingAmount], "buyer");

    // Genera blocchi per confermare
    const mineTo = await rpc<string>("getnewaddress", [], "miner");
    await rpc("generatetoaddress", [6, mineTo], "miner");

    // Verifica vout dell'escrow
    const escrowTx = await rpc<{ vout: any[] }>("gettransaction", [escrowTxid], "escrow1");
    const escrowVout = escrowTx.vout.find((v: any) => v.scriptPubKey?.address === order.escrow_address);
    if (!escrowVout) {
      return NextResponse.json({ error: "Escrow transaction does not pay to the correct address" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin.rpc("confirm_payment", {
      p_order: id,
      p_escrow_txid: escrowTxid,
      p_escrow_vout: escrowVout.n,
      p_escrow_value: Math.round(escrowVout.value * 1e8),
      p_shipping_txid: shippingTxid,
    });
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, message: "Payment confirmed", escrowTxid, shippingTxid });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
