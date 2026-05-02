// Generic per-tenant helpers.

import { PublicKey } from "@solana/web3.js";
import { findTenantAuthorityPda, type AssetId } from "@causeway-sh/core";

export interface TenantProgramConfig {
  tenantProgramId: PublicKey;
  causewayProgramId: PublicKey;
}

/// Re-export of `findTenantAuthorityPda` curried by `cfg.tenantProgramId`.
/// Tenant-program authors typically have a stable `tenantProgramId`
/// they want to reuse across calls; passing it once via `cfg` cleans
/// up the call sites.
export function findTenantAuthority(
  cfg: TenantProgramConfig,
  asset: AssetId,
  pathHash: Uint8Array,
): [PublicKey, number] {
  return findTenantAuthorityPda(cfg.tenantProgramId, asset, pathHash);
}

/// Convenience: derive the canonical Causeway `SigningRequest` PDA
/// for a tenant request. Wrapper around `findSigningRequestPda` that
/// pulls `causewayProgramId` from the tenant config.
export {
  findSigningRequestPda as findTenantRequestPda,
} from "@causeway-sh/core";
