// Fetch the Sapling vault's deposit address from the coordinator.
//
// The bech32 z-address commits to the vault's full Sapling FVK
// (ak ‖ nk ‖ ovk) plus a chosen diversifier. Only `ak` is published
// on-chain (Vault.thresholdPubkey); nk/ovk/diversifier live in the
// coordinator process. So unlike BTC/EVM/ZEC-T, the dApp cannot
// derive a Sapling vault's deposit address from on-chain state
// alone. This helper asks the coordinator for it. The bech32
// string itself is public information.

import type { CoordinatorClient } from "@causeway-sh/core";

import type { Network, SaplingAddress } from "./address.js";

export interface SaplingVaultAddress {
  /// Decoded form: network tag + raw 43 bytes.
  parsed: SaplingAddress;
  /// Raw bech32 string as the coordinator returned it. Use this
  /// when displaying to a user (it's the canonical form); use
  /// `parsed.raw` when passing to `coordinator.buildAndSignSaplingSpend`
  /// as `recipientPaymentAddressRaw`.
  bech32: string;
}

/// Fetch the configured Sapling vault deposit address from the
/// coordinator. Throws if the coordinator hasn't been bootstrapped
/// with a Sapling vault. M2.0 deployments have a single vault per
/// coordinator; the optional `vault` argument is reserved for
/// multi-vault deployments.
export async function fetchSaplingVaultAddress(
  coordinator: CoordinatorClient,
  vault?: Uint8Array,
): Promise<SaplingVaultAddress> {
  const resp = await coordinator.getSaplingVaultAddress(
    vault ? { vault } : undefined,
  );
  if (!resp.success) {
    throw new Error(`coordinator GetSaplingVaultAddress failed: ${resp.errorMessage}`);
  }
  if (resp.paymentAddressRaw.length !== 43) {
    throw new Error(
      `coordinator returned payload of ${resp.paymentAddressRaw.length} bytes; want 43`,
    );
  }
  const network = (resp.network as Network) || "mainnet";
  return {
    parsed: {
      network,
      raw: resp.paymentAddressRaw,
    },
    bech32: resp.paymentAddressBech32,
  };
}
