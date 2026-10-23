import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rpc } from "@/lib/bitcoin";
import { buildReleasePsbt, payoutAddress, releaseAmounts } from "@/lib/escrow";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { data: o } = await supabase
      .from("orders")
      .select("id, status, seller_id, buyer_id, price_sats, buyer_commission_sats, seller_commission_sats, escrow_index, escrow_descriptor, funding_txid, funding_vout, released_txid")
      .eq("id", id)
      .maybeSingle();
    if (!o || o.seller_id !== auth.user.id) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (o.status !== "COMPLETED") return NextResponse.json({ error: "The order is not completed" }, { status: 400 });
    if (o.released_txid) return NextResponse.json({ error: "Funds were already released" }, { status: 400 });
    if (!o.funding_txid || o.funding_vout === null || !o.escrow_descriptor) {
      return NextResponse.json({ error: "The order has no confirmed payment" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("psbts")
      .select("id, psbt")
      .eq("order_id", id)
      .eq("purpose", "release")
      .in("status", ["draft", "partial"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) return NextResponse.json({ id: existing.id, psbt: existing.psbt });

    const { data: profs } = await supabase
      .from("profiles")
      .select("id, wallet_xpub")
      .eq("id", o.seller_id);
    const sx = profs?.[0]?.wallet_xpub as string | null;
    const px = process.env.PLATFORM_XPUB;
    if (!sx) return NextResponse.json({ error: "The seller has no wallet public key" }, { status: 400 });
    if (!px) return NextResponse.json({ error: "Platform key is not configured" }, { status: 500 });

    const idx = Number(o.escrow_index);
    const { escrowTotal, platform } = releaseAmounts(o);
    const fee = Number(process.env.RELEASE_FEE_SATS ?? 700);
    const sellerAmount = escrowTotal - platform - fee;
    if (sellerAmount < 1000) return NextResponse.json({ error: "The amount is too small to release" }, { status: 400 });

    const sellerAddress = await payoutAddress(sx, 3, idx);
    const platformAddress = await payoutAddress(px, 3, idx);
    const txHex = (await rpc<{ hex: string }>("gettransaction", [o.funding_txid], "escrow1")).hex;

    const psbt = await buildReleasePsbt({
      descriptor: o.escrow_descriptor,
      index: idx,
      txHex,
      vout: Number(o.funding_vout),
      sellerXpub: sx,
      platformXpub: px,
      sellerAddress,
      platformAddress,
      sellerAmount,
      platformAmount: platform,
    });

    const { data: row, error } = await admin
      .from("psbts")
      .insert({ order_id: id, purpose: "release", psbt, signed_by: [], status: "draft" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ id: row.id, psbt });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
