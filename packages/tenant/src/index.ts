// @causeway-sh/tenant — generic tenant-program helpers.
//
// Tenant-program *instruction builders* are NOT exposed here — those
// are tenant-specific (each tenant deploys its own Solana program
// with its own ABI). What lives here is the cross-tenant shape:
// PDA derivers parameterised by `tenantProgramId`, status pollers
// that work against any tenant's `SigningRequest`, decoders for the
// completed signature.

export const VERSION = "0.1.0-alpha.0";

export * from "./pda.js";
export * from "./status.js";
