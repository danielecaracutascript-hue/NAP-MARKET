/**
 * Candidate non-custodial 2-of-3 policy for test-network integration.
 *
 * IMPORTANT: This module does not activate the new escrow flow. Existing
 * funded orders must continue using their original immutable descriptor.
 * Validate with Bitcoin Core and independent signers before integrating.
 */
export type EscrowParticipants = Readonly<{
  buyerXpub: string;
  sellerXpub: string;
  arbiterXpub: string;
}>;

function publicExtendedKey(value: string, role: string): string {
  const key = value.trim();
  // Only bare public BIP32 keys are accepted. Do not accept a seed, private
  // extended key, derivation path, or arbitrary descriptor fragment.
  if (!/^(?:xpub|tpub)[1-9A-HJ-NP-Za-km-z]{100,120}$/.test(key)) {
    throw new Error(`Invalid public extended key for ${role}`);
  }
  return key;
}

/**
 * Native SegWit P2WSH sorted 2-of-3 multisig.
 * Every participant must independently derive and verify the resulting
 * address, script, index and fee policy before sending test funds.
 *
 * Uses branch /0/index for each participant; the index is fixed by the
 * order and MUST be immutable before an address is presented.
 */
export function candidateEscrowDescriptor(
  participants: EscrowParticipants,
  index: number,
): string {
  if (!Number.isSafeInteger(index) || index < 0 || index >= 0x80000000) {
    throw new Error("Invalid non-hardened escrow index");
  }
  const buyer = publicExtendedKey(participants.buyerXpub, "buyer");
  const seller = publicExtendedKey(participants.sellerXpub, "seller");
  const arbiter = publicExtendedKey(participants.arbiterXpub, "arbiter");
  if (new Set([buyer, seller, arbiter]).size !== 3) {
    throw new Error("Escrow requires three distinct public extended keys");
  }
  // Fixed-index descriptor, no wildcard, so the exact script can be
  // persisted and audited per order. Core adds checksum via getdescriptorinfo.
  return `wsh(sortedmulti(2,${buyer}/0/${index},${seller}/0/${index},${arbiter}/0/${index}))`;
}
