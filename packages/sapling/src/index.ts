// @causeway-sh/sapling — Sapling shielded helpers.
//
// What's here:
//
//   - bech32 z-address parse/encode (zs1…/ztestsapling1…/zregtestsapling1…).
//   - sendToZaddr({coordinator, zcashdRpc, to, amountZat, feeZat}) end-to-end.
//   - zcashd JSON-RPC client (sendrawtransaction wrapper).
//
// What's NOT here (and won't be — by design):
//
//   - PCZT building, Groth16 prove, FROST-RedJubjub round. Those
//     run inside the coordinator daemon because the spend-auth
//     witness needs the vault `nsk`, which never leaves the
//     coordinator process. Callers ask the coordinator for a signed
//     `raw_tx` via @causeway-sh/core's CoordinatorClient and
//     broadcast it; that's the entirety of the SDK Sapling surface.

export const VERSION = "0.1.0-alpha.0";

export * from "./address.js";
export * from "./zcashd.js";
export * from "./send.js";
