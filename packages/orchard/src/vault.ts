// Fetch the Orchard vault's deposit address from the coordinator.
//
// The bech32m Orchard address commits to the vault's FullViewingKey
// (ak ‖ nk ‖ rivk) plus the configured diversifier. Only `ak` (the
// FROST-RedPallas group public key) is published on-chain
// (Vault.thresholdPubkey); `nk`+`rivk`+diversifier live in the
// coordinator process. So the dApp cannot derive a vault's Orchard
// deposit address from on-chain state alone. This helper asks the
// coordinator for it. The bech32m string itself is public.

import type { CoordinatorClient } from "@causeway-sh/core";

import {
  networkFromCoordinator,
  type OrchardAddress,
} from "./address.js";

export interface OrchardVaultAddress {
  /// Decoded form: network tag + raw 43 bytes.
  parsed: OrchardAddress;
  /// Raw bech32m string as the coordinator returned it. Use this
  /// when displaying to a user (canonical form); use `parsed.raw`
  /// when passing as `recipientPaymentAddressRaw` to
  /// `coordinator.prepareUserOrchardSpend`.
  bech32m: string;
  /// 11-byte vault diversifier (first half of the 43-byte payload).
  /// Returned separately for callers that want to compare against
  /// per-user diversifiers without re-slicing.
  diversifier: Uint8Array;
}

/// Fetch the configured Orchard vault deposit address from the
/// coordinator. Throws if the coordinator hasn't been bootstrapped
/// with an Orchard vault. The optional `vault` argument is reserved
/// for multi-vault deployments.
export async function fetchOrchardVaultAddress(
  coordinator: CoordinatorClient,
  vault?: Uint8Array,
): Promise<OrchardVaultAddress> {
  const resp = await coordinator.getOrchardVaultAddress(
    vault ? { vault } : undefined,
  );
  if (!resp.success) {
    throw new Error(`coordinator GetOrchardVaultAddress failed: ${resp.errorMessage}`);
  }
  if (resp.paymentAddressRaw.length !== 43) {
    throw new Error(
      `coordinator returned payload of ${resp.paymentAddressRaw.length} bytes; want 43`,
    );
  }
  if (resp.diversifier.length !== 11) {
    throw new Error(
      `coordinator returned diversifier of ${resp.diversifier.length} bytes; want 11`,
    );
  }
  const network = networkFromCoordinator(resp.network);
  return {
    parsed: {
      network,
      raw: resp.paymentAddressRaw,
    },
    bech32m: resp.paymentAddressBech32,
    diversifier: resp.diversifier,
  };
}
