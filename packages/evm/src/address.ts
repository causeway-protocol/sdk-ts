// EVM vault address: tweak → uncompressed pubkey → keccak256 →
// last 20 bytes → EIP-55 checksum.

import { keccak_256 } from "@noble/hashes/sha3";
import { secp256k1 } from "@noble/curves/secp256k1";
import { applyTweak } from "./tweak.js";
import { AssetId } from "@causeway-sh/core";

export interface EvmVaultAddress {
  /// EIP-55 checksummed `0x...` string.
  address: `0x${string}`;
  /// Raw 20 bytes (lowercased equivalent).
  addressBytes: Uint8Array;
  /// 33-byte compressed tweaked pubkey.
  tweakedPubkey: Uint8Array;
}

export interface DeriveVaultAddressArgs {
  vaultThresholdPubkey: Uint8Array; // 33 bytes
  tenant: Uint8Array;               // 32 bytes
  derivationPath: Uint8Array;       // canonical encoding
}

export function deriveVaultAddress(args: DeriveVaultAddressArgs): EvmVaultAddress {
  const tweaked = applyTweak(
    args.vaultThresholdPubkey,
    AssetId.Eth,
    args.tenant,
    args.derivationPath,
  );
  const addressBytes = ethAddressFromCompressedPubkey(tweaked);
  const address = eip55Checksum(addressBytes);
  return { address, addressBytes, tweakedPubkey: tweaked };
}

function ethAddressFromCompressedPubkey(compressed: Uint8Array): Uint8Array {
  const point = secp256k1.ProjectivePoint.fromHex(compressed);
  const uncompressed = point.toRawBytes(false); // 65 bytes: 0x04 || x || y
  const xy = uncompressed.slice(1);
  const h = keccak_256(xy);
  return h.slice(12);
}

export function eip55Checksum(addr: Uint8Array): `0x${string}` {
  if (addr.length !== 20) throw new Error(`address must be 20 bytes, got ${addr.length}`);
  const lower = bytesToHex(addr);
  const hashHex = bytesToHex(keccak_256(new TextEncoder().encode(lower)));
  let out = "0x";
  for (let i = 0; i < lower.length; i++) {
    const c = lower[i]!;
    if (/[a-f]/.test(c)) {
      const nibble = parseInt(hashHex[i]!, 16);
      out += nibble >= 8 ? c.toUpperCase() : c;
    } else {
      out += c;
    }
  }
  return out as `0x${string}`;
}

function bytesToHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}
