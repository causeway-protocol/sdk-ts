// Causeway tweak. Copied from @causeway-sh/evm to keep this package
// self-contained.

import { sha256 } from "@noble/hashes/sha256";
import { secp256k1 } from "@noble/curves/secp256k1";

export function computeTweak(
  assetByte: number,
  tenant: Uint8Array,
  derivationPath: Uint8Array,
): Uint8Array {
  if (tenant.length !== 32) throw new Error(`tenant must be 32 bytes, got ${tenant.length}`);
  const tag = new TextEncoder().encode("causeway:tweak:v1");
  const buf = new Uint8Array(tag.length + 1 + tenant.length + derivationPath.length);
  let o = 0;
  buf.set(tag, o); o += tag.length;
  buf[o++] = assetByte;
  buf.set(tenant, o); o += tenant.length;
  buf.set(derivationPath, o);
  return sha256(buf);
}

export function applyTweak(
  vaultPubkey: Uint8Array,
  assetByte: number,
  tenant: Uint8Array,
  derivationPath: Uint8Array,
): Uint8Array {
  if (vaultPubkey.length !== 33) {
    throw new Error(`vault_pubkey must be 33 bytes, got ${vaultPubkey.length}`);
  }
  const tBytes = computeTweak(assetByte, tenant, derivationPath);
  const tScalar = bytesToBigint(tBytes) % secp256k1.CURVE.n;
  const vaultPoint = secp256k1.ProjectivePoint.fromHex(vaultPubkey);
  const tweakPoint = secp256k1.ProjectivePoint.BASE.multiply(tScalar);
  return vaultPoint.add(tweakPoint).toRawBytes(true);
}

function bytesToBigint(b: Uint8Array): bigint {
  let acc = 0n;
  for (const x of b) acc = (acc << 8n) | BigInt(x);
  return acc;
}
