// P2TR vault address: Causeway tweak → BIP-341 TapTweak → bech32m.

import * as btc from "@scure/btc-signer";
import { secp256k1, schnorr } from "@noble/curves/secp256k1";
import { applyTweak } from "./tweak.js";
import { AssetId } from "@causeway-sh/core";

export type Network = "mainnet" | "testnet4";

export interface BtcVaultAddress {
  /// `bc1p…` (mainnet) or `tb1p…` (testnet4) bech32m string.
  address: string;
  /// 32-byte x-only output key (post-TapTweak point's x coordinate).
  outputKey: Uint8Array;
  /// 33-byte compressed internal key (post-Causeway-tweak, pre-TapTweak).
  internalKey: Uint8Array;
}

export interface DeriveVaultAddressArgs {
  vaultThresholdPubkey: Uint8Array; // 33 bytes
  tenant: Uint8Array;               // 32 bytes
  derivationPath: Uint8Array;       // canonical encoding
  network: Network;
}

export function deriveVaultAddress(args: DeriveVaultAddressArgs): BtcVaultAddress {
  // Step 1: Causeway tweak (asset = BTC = 0).
  const internalKey = applyTweak(
    args.vaultThresholdPubkey,
    AssetId.Btc,
    args.tenant,
    args.derivationPath,
  );
  const internalXOnly = internalKey.slice(1);
  const network = args.network === "mainnet" ? btc.NETWORK : btc.TEST_NETWORK;
  const p2tr = btc.p2tr(internalXOnly, undefined, network);
  if (!p2tr.address) throw new Error("p2tr did not produce an address");
  const outputKey = bip341TaptweakOutputKey(internalXOnly);
  return {
    address: p2tr.address,
    outputKey,
    internalKey,
  };
}

/// BIP-341 `taggedHash("TapTweak", x_only_internal_key)` scalar, then
/// add `t·G` to the internal point. Empty merkle root — pure key-spend
/// Taproot, matching M1.0.
function bip341TaptweakOutputKey(internalXOnly: Uint8Array): Uint8Array {
  const tweakScalar = schnorr.utils.taggedHash("TapTweak", internalXOnly);
  const tBig = bytesToBigint(tweakScalar) % secp256k1.CURVE.n;
  const internalPoint = secp256k1.ProjectivePoint.fromHex(
    new Uint8Array([0x02, ...internalXOnly]),
  );
  const out = internalPoint.add(secp256k1.ProjectivePoint.BASE.multiply(tBig));
  return out.toRawBytes(true).slice(1);
}

function bytesToBigint(b: Uint8Array): bigint {
  let acc = 0n;
  for (const x of b) acc = (acc << 8n) | BigInt(x);
  return acc;
}
