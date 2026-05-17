// Generic per-tenant helpers.

import { PublicKey } from "@solana/web3.js";
import {
  findTenantAuthorityPda,
  findTenantAuthorityPdaForSegments,
  type AssetId,
} from "@causeway-sh/core";
import {
  REFERENCE_TENANT_PROGRAM_ID,
  REFERENCE_TENANT_REQUEST_SEED,
} from "./constants.js";

export interface TenantProgramConfig {
  tenantProgramId: PublicKey;
  causewayProgramId: PublicKey;
}

/// Re-export of `findTenantAuthorityPda` curried by `cfg.tenantProgramId`.
/// `pathHash` MUST be the canonical 32-byte SHA-256 of the canonical
/// derivation-path encoding. If you have raw segments instead, use
/// `findTenantAuthorityForSegments` to avoid silent wrong-PDA bugs.
export function findTenantAuthority(
  cfg: TenantProgramConfig,
  asset: AssetId,
  pathHash: Uint8Array,
): [PublicKey, number] {
  return findTenantAuthorityPda(cfg.tenantProgramId, asset, pathHash);
}

/// Like `findTenantAuthority` but takes raw derivation-path segments
/// and computes the canonical hash internally. Use this if you only
/// have segments (e.g. `[userPubkey.toBytes()]`) — passing those raw
/// bytes to `findTenantAuthority` would type-check but produce a PDA
/// the on-chain program never agrees with.
export function findTenantAuthorityForSegments(
  cfg: TenantProgramConfig,
  asset: AssetId,
  pathSegments: Uint8Array[],
): [PublicKey, number] {
  return findTenantAuthorityPdaForSegments(
    cfg.tenantProgramId,
    asset,
    pathSegments,
  );
}

/// The tenant-side per-request PDA used by tenants following the
/// canonical initiate-send ABI:
///   seeds = ["tenant-demo:request:v1", user, request_id]
///   owner = tenant_program_id
///
/// Distinct from Causeway's `SigningRequest` PDA — the tenant program
/// owns this one. Defaults to the reference tenant deployment; pass
/// your own `tenantProgramId` to target a different deployment with
/// the same seed shape.
export function findReferenceTenantRequestPda(
  user: PublicKey,
  requestId: Uint8Array,
  tenantProgramId: PublicKey = REFERENCE_TENANT_PROGRAM_ID,
): [PublicKey, number] {
  if (requestId.length !== 32) {
    throw new Error(`requestId must be 32 bytes, got ${requestId.length}`);
  }
  return PublicKey.findProgramAddressSync(
    [REFERENCE_TENANT_REQUEST_SEED, user.toBytes(), requestId],
    tenantProgramId,
  );
}
