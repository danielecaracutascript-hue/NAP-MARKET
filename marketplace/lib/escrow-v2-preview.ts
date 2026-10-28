import { candidateEscrowDescriptor, type EscrowParticipants } from "./escrow-v2";
import { rpc } from "./bitcoin";

type DescriptorInfo = {
  descriptor: string;
  isrange: boolean;
  issolvable: boolean;
  hasprivatekeys: boolean;
};

export type EscrowV2Preview = Readonly<{
  network: "regtest" | "signet";
  descriptor: string;
  address: string;
  index: number;
}>;

/**
 * Test-only, read-only descriptor preview.
 * No database writes, wallet imports, funding or signing are performed.
 * Call only from a trusted server context, never directly from the browser.
 */
export async function previewEscrowV2(
  participants: EscrowParticipants,
  index: number,
): Promise<EscrowV2Preview> {
  const blockchain = await rpc<{ chain: string }>("getblockchaininfo");
  if (blockchain.chain !== "regtest" && blockchain.chain !== "signet") {
    throw new Error("Escrow v2 preview is restricted to regtest and signet");
  }

  const descriptor = candidateEscrowDescriptor(participants, index);
  const info = await rpc<DescriptorInfo>("getdescriptorinfo", [descriptor]);
  if (info.hasprivatekeys || info.isrange || !info.issolvable) {
    throw new Error("Descriptor must be fixed-index, public-only and solvable");
  }

  const addresses = await rpc<string[]>("deriveaddresses", [info.descriptor]);
  if (addresses.length !== 1 || !addresses[0]) {
    throw new Error("Bitcoin Core did not derive exactly one escrow address");
  }
  const address = addresses[0];
  if (blockchain.chain === "regtest" && !address.startsWith("bcrt1")) {
    throw new Error("Unexpected regtest address");
  }
  if (blockchain.chain === "signet" && !address.startsWith("tb1")) {
    throw new Error("Unexpected signet address");
  }
  return {
    network: blockchain.chain,
    descriptor: info.descriptor,
    address,
    index,
  };
}
