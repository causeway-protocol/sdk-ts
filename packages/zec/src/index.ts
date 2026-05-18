// @causeway-sh/zec — Zcash transparent helpers.
//
// - tweak: shared with @causeway-sh/evm; copied here to keep
//          asset packages independent (no cross-asset deps)
// - address: tweak → hash160 → Base58Check
// - zip244: hand-rolled v5 transparent sighash (spike A)
// - tx: build unsigned v5 + sighash
// - sign: scriptSig assembly with DER + low-S

export const VERSION = "0.1.0-alpha.4";

export * from "./tweak.js";
export * from "./address.js";
export * from "./zip244.js";
export * from "./tx.js";
export * from "./sign.js";
export * from "./lwd.js";
export * from "./lwd-grpc.js";
