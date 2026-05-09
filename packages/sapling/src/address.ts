// Sapling payment-address bech32 parse/encode.
//
// Wire format (Zcash protocol §5.6.4):
//
//   z-addr = bech32(<hrp>, raw43)
//   raw43  = diversifier(11) ‖ pk_d(32)
//
// hrp selects network:
//   - zs              — mainnet
//   - ztestsapling    — public testnet
//   - zregtestsapling — local regtest
//
// Sapling uses bech32 (NOT bech32m — bech32m is for unified
// addresses). We always pin the bech32 variant explicitly so a
// mangled bech32m string fails at decode rather than silently
// round-tripping with a different checksum.

import { bech32 } from "@scure/base";

export type Network = "mainnet" | "testnet" | "regtest";

const HRP: Record<Network, string> = {
  mainnet: "zs",
  testnet: "ztestsapling",
  regtest: "zregtestsapling",
};

const HRP_TO_NETWORK: Record<string, Network> = {
  zs: "mainnet",
  ztestsapling: "testnet",
  zregtestsapling: "regtest",
};

export interface SaplingAddress {
  network: Network;
  /// 11-byte diversifier ‖ 32-byte pk_d.
  raw: Uint8Array;
}

/// Decode a `zs1…` / `ztestsapling1…` / `zregtestsapling1…` string.
/// Throws on unknown hrp, bech32 checksum failure, or wrong payload length.
export function decodeSaplingAddress(addr: string): SaplingAddress {
  // The default bech32 character limit (90) is too low for
  // ztestsapling1 / zregtestsapling1 prefixes — Sapling addresses
  // run ~88 chars (mainnet) up to ~98 chars (regtest). Pass an
  // explicit limit > the longest possible address.
  const decoded = bech32.decode(addr as `${string}1${string}`, 1023);
  const network = HRP_TO_NETWORK[decoded.prefix];
  if (!network) {
    throw new Error(
      `not a Sapling hrp '${decoded.prefix}' (expected zs/ztestsapling/zregtestsapling)`,
    );
  }
  const raw = bech32.fromWords(decoded.words);
  if (raw.length !== 43) {
    throw new Error(`Sapling payload not 43 bytes (got ${raw.length})`);
  }
  return { network, raw: new Uint8Array(raw) };
}

/// Encode a network + 43-byte raw payload back into a bech32 z-address.
export function encodeSaplingAddress(network: Network, raw: Uint8Array): string {
  if (raw.length !== 43) {
    throw new Error(`Sapling payload must be 43 bytes (got ${raw.length})`);
  }
  return bech32.encode(HRP[network] as any, bech32.toWords(raw), 1023);
}
