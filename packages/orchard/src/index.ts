// @causeway-sh/orchard — Orchard shielded helpers.
//
// What's here:
//
//   - bech32m Orchard address parse/encode
//     (uorchardmain1… / uorchardtest1… / uorchardreg1…).
//   - fetchOrchardVaultAddress({coordinator}) — vault's deposit
//     address as advertised by the coordinator.
//   - fetchUserOrchardAddress / fetchUserOrchardBalance — per-user
//     deposit address + unspent balance, derived from a (tenant,
//     user_pubkey) diversifier.
//   - sendUserOrchard({coordinator, ...}) — two-phase user spend
//     wrapper: PrepareUserOrchardSpend → on-chain
//     `initiate_orchard_send` (caller-driven) → RunOrchardSigningRound
//     → BroadcastOrchardTx.
//
// What's NOT here (and won't be — by design):
//
//   - PCZT building, Halo 2 prove, FROST-RedPallas round. Those run
//     inside the coordinator daemon because the spend-auth witness
//     needs the vault `nk`+`rivk`, which never leave the coordinator
//     process. Callers ask the coordinator for a signed `raw_tx` via
//     @causeway-sh/core's CoordinatorClient and broadcast it. That's
//     the entirety of the SDK Orchard surface.

export const VERSION = "0.1.0-alpha.4";

export * from "./address.js";
export * from "./vault.js";
export * from "./user.js";
export * from "./send.js";
