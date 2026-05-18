// Orchard payment-address bech32m parse/encode.
//
// Wire format (mirror of the coordinator's `encode_orchard_bech32m`
// in `coordinator/src/control.rs`):
//
//   o-addr = bech32m(<hrp>, raw43)
//   raw43  = diversifier(11) ‖ pk_d(32)
//
// hrp selects network:
//   - uorchardmain — mainnet
//   - uorchardtest — public testnet
//   - uorchardreg  — local regtest
//
// These are NOT canonical Zcash Unified Addresses (ZIP-316). Causeway
// encodes the raw Orchard address with bech32m + an Orchard-only HRP
// for compactness; a full UA would require a multi-receiver envelope
// that adds bytes for no useful purpose given the SDK only ever
// interacts with the Orchard pool.
//
// Orchard uses bech32m (NOT bech32 — bech32 is for Sapling). We
// always pin the bech32m variant explicitly so a mangled bech32
// string fails at decode rather than silently round-tripping with a
// different checksum.

import { bech32m } from "@scure/base";

export type OrchardNetwork = "mainnet" | "testnet" | "regtest";

const HRP: Record<OrchardNetwork, string> = {
  mainnet: "uorchardmain",
  testnet: "uorchardtest",
  regtest: "uorchardreg",
};

const HRP_TO_NETWORK: Record<string, OrchardNetwork> = {
  uorchardmain: "mainnet",
  uorchardtest: "testnet",
  uorchardreg: "regtest",
};

export interface OrchardAddress {
  network: OrchardNetwork;
  /// 11-byte diversifier ‖ 32-byte pk_d.
  raw: Uint8Array;
}

/// Decode a `uorchard{main,test,reg}1…` string. Throws on unknown hrp,
/// bech32m checksum failure, or wrong payload length.
export function decodeOrchardAddress(addr: string): OrchardAddress {
  // Same limit story as Sapling: the default bech32 limit (90) is
  // shorter than the longest Orchard prefix would allow with a
  // 43-byte payload. Bump explicitly.
  const decoded = bech32m.decode(addr as `${string}1${string}`, 1023);
  const network = HRP_TO_NETWORK[decoded.prefix];
  if (!network) {
    throw new Error(
      `not an Orchard hrp '${decoded.prefix}' (expected uorchardmain/uorchardtest/uorchardreg)`,
    );
  }
  const raw = bech32m.fromWords(decoded.words);
  if (raw.length !== 43) {
    throw new Error(`Orchard payload not 43 bytes (got ${raw.length})`);
  }
  return { network, raw: new Uint8Array(raw) };
}

/// Encode a network + 43-byte raw payload back into a bech32m
/// Orchard address.
export function encodeOrchardAddress(
  network: OrchardNetwork,
  raw: Uint8Array,
): string {
  if (raw.length !== 43) {
    throw new Error(`Orchard payload must be 43 bytes (got ${raw.length})`);
  }
  return bech32m.encode(HRP[network] as any, bech32m.toWords(raw), 1023);
}

/// Map the coordinator's `network` string (proto: "main" | "test" |
/// "regtest") to the SDK's `OrchardNetwork` ("mainnet" | "testnet" |
/// "regtest"). The proto and the SDK use slightly different labels;
/// this lifts the proto label to the SDK label.
export function networkFromCoordinator(coordinatorNetwork: string): OrchardNetwork {
  switch (coordinatorNetwork) {
    case "main":
    case "mainnet":
      return "mainnet";
    case "test":
    case "testnet":
      return "testnet";
    case "regtest":
      return "regtest";
    default:
      throw new Error(
        `coordinator returned unknown orchard network '${coordinatorNetwork}'`,
      );
  }
}
