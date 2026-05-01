// PDA derivations. Seeds match the on-chain `programs/causeway/src/state/`
// constants exactly. Verified vs sdk-rs reference vectors in
// `test/pda.test.ts`.

import { PublicKey } from "@solana/web3.js";
import type { AssetId } from "./enums.js";

const enc = new TextEncoder();
const PROTOCOL_CONFIG_SEED = enc.encode("causeway:protocol-config:v1");
const VAULT_SEED = enc.encode("causeway:vault:v1");
const SIGNING_REQUEST_SEED = enc.encode("causeway:signing-request:v1");
const TENANT_AUTHORITY_SEED = enc.encode("causeway:tenant-authority:v1");

/// `causeway:protocol-config:v1`
export function findProtocolConfigPda(
  programId: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([PROTOCOL_CONFIG_SEED], programId);
}

/// `causeway:vault:v1 || asset_byte || u32_le(epoch)`
export function findVaultPda(
  programId: PublicKey,
  asset: AssetId,
  epoch: number,
): [PublicKey, number] {
  if (!Number.isInteger(epoch) || epoch < 0 || epoch > 0xffffffff) {
    throw new Error(`vault epoch out of range: ${epoch}`);
  }
  const epochLe = new Uint8Array(4);
  new DataView(epochLe.buffer).setUint32(0, epoch >>> 0, true);
  return PublicKey.findProgramAddressSync(
    [VAULT_SEED, new Uint8Array([asset]), epochLe],
    programId,
  );
}

/// `causeway:signing-request:v1 || vault || tenant_authority || path_hash || request_id`
export function findSigningRequestPda(
  programId: PublicKey,
  vault: PublicKey,
  tenantAuthority: PublicKey,
  pathHash: Uint8Array,
  requestId: Uint8Array,
): [PublicKey, number] {
  if (pathHash.length !== 32)
    throw new Error(`pathHash must be 32 bytes, got ${pathHash.length}`);
  if (requestId.length !== 32)
    throw new Error(`requestId must be 32 bytes, got ${requestId.length}`);
  return PublicKey.findProgramAddressSync(
    [
      SIGNING_REQUEST_SEED,
      vault.toBytes(),
      tenantAuthority.toBytes(),
      pathHash,
      requestId,
    ],
    programId,
  );
}

/// `causeway:tenant-authority:v1 || asset_byte || path_hash` — under
/// the tenant program's id, not Causeway's.
export function findTenantAuthorityPda(
  tenantProgramId: PublicKey,
  asset: AssetId,
  pathHash: Uint8Array,
): [PublicKey, number] {
  if (pathHash.length !== 32)
    throw new Error(`pathHash must be 32 bytes, got ${pathHash.length}`);
  return PublicKey.findProgramAddressSync(
    [TENANT_AUTHORITY_SEED, new Uint8Array([asset]), pathHash],
    tenantProgramId,
  );
}
