// @causeway-sh/tenant — tenant-program helpers.
//
// Causeway is parameterised by a *tenant* program: each tenant deploys
// its own Solana program whose handlers CPI into Causeway as a tenant
// authority PDA. There is therefore no single canonical "Causeway"
// instruction surface — each tenant defines its own.
//
// What ships here:
//
//   - PDA derivers: `findTenantAuthority` / `findTenantAuthorityForSegments`
//     work against any tenant program.
//
//   - Status pollers + completed-signature decoders: work against any
//     Causeway `SigningRequest` regardless of which tenant created it.
//
//   - Instruction builders for the **canonical initiate-send ABI**:
//     `buildInitiateBtcSend`, `buildInitiateEthSend`, …
//     These target any tenant program whose `initiate_*_send` handlers
//     follow Causeway's reference shape (one segment per-user binding,
//     standard 8-account Anchor layout, shared argument tuple). They
//     default to the deployed reference tenant
//     (`REFERENCE_TENANT_PROGRAM_ID`) for quickstart; override
//     `tenantProgramId` to target your own deployment of the same ABI.
//     Tenants with a divergent ABI ship their own builders.

export const VERSION = "0.1.0-alpha.4";

export * from "./constants.js";
export * from "./pda.js";
export * from "./status.js";
export * from "./initiate.js";
