import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rpc } from "@/lib/bitcoin";
import {
  derivePubkey,
  hexOf,
  payoutAddress,
  releaseAmounts,
  sigPubkeys,
  signWith,
  txFingerprint,
  verifyReleasePsbt,
} from "@/lib/escrow";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();
    const signed = String(body.psbt ?? "");
    if (!signed) return NextResponse.json({ error: "Missing transaction" }, { status: 400 });

    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { data: o } = await supabase
      .from("orders")
      .select("id, status, seller_id, price_sats, buyer_commission_sats, seller_commission_sats, escrow_index, escrow_descriptor, funding_txid, funding_vout, released_txid")
      .eq("id", id)
      .maybeSingle();
    if (!o || o.seller_id !== auth.user.id) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // --- Regola della piattaforma: firma solo se tutto torna ---
    if (o.status !== "COMPLETED" || o.released_txid) {
      return NextResponse.json({ error: "Platform policy: the order is not releasable" }, { status: 400 });
    }
    const admin = createAdminClient();
    const { data: draft } = await admin
      .from("psbts")
      .select("id, psbt")
      .eq("order_id", id)
      .eq("purpose", "release")
      .in("status", ["draft", "partial"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!draft) return NextResponse.json({ error: "No release transaction was prepared" }, { status: 400 });
    if ((await txFingerprint(draft.psbt)) !== (await txFingerprint(signed))) {
      return NextResponse.json({ error: "Platform policy: this is not the transaction that was prepared" }, { status: 400 });
    }

    const { data: profs } = await supabase.from("profiles").select("id, wallet_xpub").eq("id", o.seller_id);
    const sx = profs?.[0]?.wallet_xpub as string | null;
    const px = process.env.PLATFORM_XPUB;
    const mnemonic = process.env.PLATFORM_MNEMONIC;
    if (!sx || !px || !mnemonic) return NextResponse.json({ error: "Keys are not configured" }, { status: 500 });

    const idx = Number(o.escrow_index);
    const { escrowTotal, platform } = releaseAmounts(o);
    const check = await verifyReleasePsbt({
      psbtBase64: signed,
      fundingTxid: o.funding_txid as string,
      fundingVout: Number(o.funding_vout),
      escrowTotal,
      platformAmount: platform,
      sellerAddress: await payoutAddress(sx, 3, idx),
      platformAddress: await payoutAddress(px, 3, idx),
      maxFee: 5000,
    });
    if (!check.ok) {
      return NextResponse.json({ error: "Platform policy refused to sign: " + check.reason }, { status: 400 });
    }

    // --- Firma della piattaforma ---
    const sellerPub = await derivePubkey(sx, 0, idx);
    const platformPub = await derivePubkey(px, 0, idx);
    const both = await signWith({ mnemonic, psbtBase64: signed, keepPubkeys: [sellerPub, platformPub] });
    const have = await sigPubkeys(both);
    if (!have.includes(hexOf(sellerPub)) || !have.includes(hexOf(platformPub))) {
      return NextResponse.json({ error: "A signature is missing" }, { status: 400 });
    }

    // --- Completamento con Bitcoin Core e invio alla rete ---
    const done = await rpc<{ complete: boolean; hex?: string }>("descriptorprocesspsbt", [
      both,
      [{ desc: o.escrow_descriptor, range: [idx, idx] }],
    ]);
    if (!done.complete || !done.hex) {
      return NextResponse.json({ error: "The transaction could not be completed" }, { status: 400 });
    }
    const txid = await rpc<string>("sendrawtransaction", [done.hex]);

    await admin
      .from("psbts")
      .update({ psbt: both, signed_by: ["seller", "platform"], status: "broadcast", txid })
      .eq("id", draft.id);
    const { error } = await admin.rpc("mark_order_released", { p_order: id, p_txid: txid });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, txid });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
