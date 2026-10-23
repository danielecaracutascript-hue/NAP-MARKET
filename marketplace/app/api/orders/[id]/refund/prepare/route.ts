import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rpc } from "@/lib/bitcoin";
import { buildRefundPsbt, payoutAddress, refundAmounts, refundKindFromEvents } from "@/lib/escrow";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { data: o } = await supabase
      .from("orders")
      .select("id, status, buyer_id, price_sats, buyer_commission_sats, seller_commission_sats, escrow_index, escrow_descriptor, funding_txid, funding_vout, refunded_txid")
      .eq("id", id)
      .maybeSingle();
    if (!o || o.buyer_id !== auth.user.id) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (o.status !== "REFUNDED") return NextResponse.json({ error: "The order is not refunded" }, { status: 400 });
    if (o.refunded_txid) return NextResponse.json({ error: "The refund was already sent" }, { status: 400 });
    if (!o.funding_txid || o.funding_vout === null || !o.escrow_descriptor) {
      return NextResponse.json({ error: "The order has no confirmed payment" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("psbts")
      .select("id, psbt")
      .eq("order_id", id)
      .eq("purpose", "refund")
      .in("status", ["draft", "partial"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) return NextResponse.json({ id: existing.id, psbt: existing.psbt });

    const { data: evs } = await admin.from("order_events").select("type, data").eq("order_id", id);
    const kind = refundKindFromEvents(evs ?? []);
    if (!kind) return NextResponse.json({ error: "No refund reason is recorded for this order" }, { status: 400 });

    const { data: profs } = await supabase.from("profiles").select("id, wallet_xpub").eq("id", o.buyer_id);
    const bx = profs?.[0]?.wallet_xpub as string | null;
    const px = process.env.PLATFORM_XPUB;
    if (!bx) return NextResponse.json({ error: "The buyer has no wallet public key" }, { status: 400 });
    if (!px) return NextResponse.json({ error: "Platform key is not configured" }, { status: 500 });

    const idx = Number(o.escrow_index);
    const { escrowTotal, platform } = refundAmounts(o, kind);
    const fee = Number(process.env.RELEASE_FEE_SATS ?? 700);
    const buyerAmount = escrowTotal - platform - fee;
    if (buyerAmount < 1000) return NextResponse.json({ error: "The amount is too small to refund" }, { status: 400 });

    const txHex = (await rpc<{ hex: string }>("gettransaction", [o.funding_txid], "escrow1")).hex;
    const psbt = await buildRefundPsbt({
      descriptor: o.escrow_descriptor,
      index: idx,
      txHex,
      vout: Number(o.funding_vout),
      buyerXpub: bx,
      platformXpub: px,
      buyerAddress: await payoutAddress(bx, 3, idx),
      platformAddress: await payoutAddress(px, 3, idx),
      buyerAmount,
      platformAmount: platform,
    });

    const { data: row, error } = await admin
      .from("psbts")
      .insert({ order_id: id, purpose: "refund", psbt, signed_by: [], status: "draft" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ id: row.id, psbt });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
