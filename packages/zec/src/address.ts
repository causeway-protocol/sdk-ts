// Zcash transparent (t-) address derivation:
// Causeway tweak → HASH160 (RIPEMD160 ∘ SHA256) → Base58Check with
// network prefix.

import { sha256 } from "@noble/hashes/sha256";
import { ripemd160 } from "@noble/hashes/ripemd160";
import bs58check from "bs58check";

import { applyTweak } from "./tweak.js";
import { AssetId } from "@causeway-sh/core";

/// `tm…` testnet/regtest prefix.
export const TESTNET_P2PKH_PREFIX = new Uint8Array([0x1d, 0x25]);
/// `t1…` mainnet prefix.
export const MAINNET_P2PKH_PREFIX = new Uint8Array([0x1c, 0xb8]);

export type Network = "testnet" | "regtest" | "mainnet";

export function networkPrefix(network: Network): Uint8Array {
  switch (network) {
    case "testnet":
    case "regtest":
      return TESTNET_P2PKH_PREFIX;
    case "mainnet":
      return MAINNET_P2PKH_PREFIX;
  }
}

export interface ZecVaultAddress {
  /// `tm…` / `t1…` Base58Check string.
  tAddress: string;
  /// 20-byte HASH160 of the tweaked compressed pubkey.
  pkh: Uint8Array;
  /// 33-byte compressed tweaked pubkey.
  tweakedPubkey: Uint8Array;
}

export interface DeriveVaultAddressArgs {
  vaultThresholdPubkey: Uint8Array; // 33 bytes
  tenant: Uint8Array;               // 32 bytes
  derivationPath: Uint8Array;       // canonical encoding
  network: Network;
}

export function deriveVaultAddress(args: DeriveVaultAddressArgs): ZecVaultAddress {
  const tweaked = applyTweak(
    args.vaultThresholdPubkey,
    AssetId.ZecT,
    args.tenant,
    args.derivationPath,
  );
  const pkh = hash160(tweaked);
  const prefix = networkPrefix(args.network);
  const tAddress = base58checkEncode(prefix, pkh);
  return { tAddress, pkh, tweakedPubkey: tweaked };
}

/// `RIPEMD160(SHA256(bytes))`.
export function hash160(bytes: Uint8Array): Uint8Array {
  return ripemd160(sha256(bytes));
}

export function base58checkEncode(prefix: Uint8Array, payload: Uint8Array): string {
  const data = new Uint8Array(prefix.length + payload.length);
  data.set(prefix, 0);
  data.set(payload, prefix.length);
  return bs58check.encode(data);
}

export function base58checkDecode(s: string): { prefix: Uint8Array; pkh: Uint8Array } {
  const decoded = bs58check.decode(s);
  if (decoded.length !== 22) {
    throw new Error(`t-address must be 22 bytes after Base58Check, got ${decoded.length}`);
  }
  return {
    prefix: decoded.slice(0, 2),
    pkh: decoded.slice(2),
  };
}
