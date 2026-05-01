// @causeway-sh/core — Causeway TypeScript SDK, core package.
//
// Re-exports the public surface: enums, PDAs, account decoders,
// program ix builders, Solana precompile ix builders, the
// coordinator gRPC-Web client, the `complete_signing` convenience
// helper, and typed SDK errors.

export const VERSION = "0.1.0-alpha.0";

export * from "./enums.js";
export * from "./pda.js";
export * from "./accounts.js";
export * from "./discriminators.js";
export * from "./instructions.js";
export * from "./precompile.js";
