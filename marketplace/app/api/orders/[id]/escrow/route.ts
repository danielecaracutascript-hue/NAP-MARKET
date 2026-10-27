import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rpc } from "@/lib/bitcoin";

const T1 = Number(process.env.ESCROW_CONCORDATA_BLOCKS ?? 5);
const T2 = Number(process.env.ESCROW_BUYER_TIMELOCK_BLOCKS ?? 10);

type Info = { descriptor: string; issolvable: boolean };

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { data: order } = await supabase
      .from("orders")
      .select("id, buyer_id, seller_id, status, escrow_index, escrow_address")
      .eq("id", id)
      .maybeSingle();
    if (!order || order.buyer_id !== auth.user.id) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (order.status !== "CREATED") {
      return NextResponse.json({ error: "Order is not waiting for payment" }, { status: 400 });
    }
    if (order.escrow_address) {
      return NextResponse.json({ ok: true, message: "Payment details already created" });
    }

    const { data: profs } = await supabase
      .from("profiles")
      .select("id, wallet_xpub")
      .in("id", [order.buyer_id, order.seller_id]);
    const bx = profs?.find((p) => p.id === order.buyer_id)?.wallet_xpub;
    const sx = profs?.find((p) => p.id === order.seller_id)?.wallet_xpub;
    const px = process.env.PLATFORM_XPUB;
    if (!bx || !sx) {
      return NextResponse.json({ error: "Buyer and seller both need a wallet public key in their profile" }, { status: 400 });
    }
    if (!px) return NextResponse.json({ error: "Platform key is not configured" }, { status: 500 });

    const k = (x: string, b: number) => `${x}/${b}/*`;
    const desc =
      `wsh(or_i(and_v(v:pk(${k(px, 0)}),or_d(pk(${k(bx, 0)}),pk(${k(sx, 0)}))),` +
      `or_i(and_v(v:multi(2,${k(bx, 2)},${k(sx, 2)}),older(${T1})),` +
      `and_v(v:pk(${k(bx, 1)}),older(${T2})))))`;

    const info = await rpc<Info>("getdescriptorinfo", [desc]);
    if (!info.issolvable) throw new Error("The escrow script is not solvable");
    const idx = order.escrow_index as number;
    const addrs = await rpc<string[]>("deriveaddresses", [info.descriptor, [idx, idx]]);
    const escrowAddress = addrs[0];

    const imp = await rpc<{ success: boolean; error?: { message: string } }[]>(
      "importdescriptors",
      [[{ desc: info.descriptor, timestamp: "now", range: [0, 10000] }]],
      "escrow1"
    );
    if (!imp[0]?.success) throw new Error("Watch import failed: " + (imp[0]?.error?.message ?? "unknown"));

    const shipAddress = await rpc<string>("getnewaddress", ["order-" + id.slice(0, 8)], "shipping");

    const admin = createAdminClient();
    const { error } = await admin.rpc("set_order_escrow", {
      p_order: id,
      p_descriptor: info.descriptor,
      p_address: escrowAddress,
      p_shipping_address: shipAddress,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, message: "Payment details created" });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
