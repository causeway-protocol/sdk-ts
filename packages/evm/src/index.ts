// @causeway-sh/evm — EVM-specific helpers.
//
// - address: derive vault address from threshold pubkey + tweak
// - tx: build EIP-1559 unsigned tx + sighash
// - sign: assemble signed tx (0x02 || rlp(...)) from r/s/v

export const VERSION = "0.1.0-alpha.3";

export * from "./tweak.js";
export * from "./address.js";
export * from "./tx.js";
export * from "./sign.js";
