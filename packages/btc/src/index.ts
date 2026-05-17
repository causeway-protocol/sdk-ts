// @causeway-sh/btc — Bitcoin (P2TR) helpers.
//
// - tweak: shared with @causeway-sh/{evm,zec}; copied locally so the
//          asset packages stay independent (no cross-asset imports)
// - address: tweak ∘ BIP-341 TapTweak → bech32m
// - tx: BIP-341 sighash for the M1.0 single-input single-output shape
// - sign: assemble Taproot key-spend witness from the 64-byte Schnorr sig
// - rpc: minimal bitcoind JSON-RPC client

export const VERSION = "0.1.0-alpha.3";

export * from "./tweak.js";
export * from "./address.js";
export * from "./tx.js";
export * from "./sign.js";
export * from "./rpc.js";
export * from "./mempool-space.js";
