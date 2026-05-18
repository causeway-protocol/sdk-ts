// Per-user Orchard deposit address + unspent balance.
//
// Each (tenant, user_pubkey) tuple gets its own 11-byte diversifier
// derived inside the coordinator:
//
//   diversifier = SHA-256("causeway:orchard-diversifier:v1"
//                          ‖ tenant_program_id ‖ user_pubkey
//                          ‖ counter)[..11]
//
// The coordinator increments `counter` until the resulting
// diversifier maps to a valid Orchard `pk_d` (rejection sampling).
// Notes deposited to a user's diversifier can only be spent by that
// user via `PrepareUserOrchardSpend` — the coordinator filters
// input-note selection by diversifier.

import type {
  CoordinatorClient,
  GetUserOrchardAddressRequest,
  GetUserOrchardBalanceRequest,
} from "@causeway-sh/core";

import {
  networkFromCoordinator,
  type OrchardAddress,
} from "./address.js";

export interface UserOrchardAddress {
  /// Decoded form.
  parsed: OrchardAddress;
  /// Raw bech32m string.
  bech32m: string;
  /// 11-byte user-specific diversifier.
  diversifier: Uint8Array;
}

export interface UserOrchardBalance {
  /// Sum of unspent note values addressed to this user's diversifier.
  unspentZat: bigint;
  /// Number of unspent notes addressed to the user's diversifier.
  noteCount: number;
  /// Latest block height the scanner has fully ingested when this
  /// balance was computed. Useful for staleness UI ("synced to
  /// block N, M minutes ago").
  lastSeenHeight: bigint;
}

/// Fetch a user's per-tenant Orchard deposit address.
export async function fetchUserOrchardAddress(
  coordinator: CoordinatorClient,
  req: GetUserOrchardAddressRequest,
): Promise<UserOrchardAddress> {
  if (req.tenantProgramId.length !== 32) {
    throw new Error(`tenantProgramId must be 32 bytes (got ${req.tenantProgramId.length})`);
  }
  if (req.userPubkey.length !== 32) {
    throw new Error(`userPubkey must be 32 bytes (got ${req.userPubkey.length})`);
  }
  const resp = await coordinator.getUserOrchardAddress(req);
  if (!resp.success) {
    throw new Error(`coordinator GetUserOrchardAddress failed: ${resp.errorMessage}`);
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
    parsed: { network, raw: resp.paymentAddressRaw },
    bech32m: resp.paymentAddressBech32,
    diversifier: resp.diversifier,
  };
}

/// Fetch a user's unspent Orchard balance (sum of unspent note values
/// addressed to their diversifier).
export async function fetchUserOrchardBalance(
  coordinator: CoordinatorClient,
  req: GetUserOrchardBalanceRequest,
): Promise<UserOrchardBalance> {
  if (req.tenantProgramId.length !== 32) {
    throw new Error(`tenantProgramId must be 32 bytes (got ${req.tenantProgramId.length})`);
  }
  if (req.userPubkey.length !== 32) {
    throw new Error(`userPubkey must be 32 bytes (got ${req.userPubkey.length})`);
  }
  const resp = await coordinator.getUserOrchardBalance(req);
  if (!resp.success) {
    throw new Error(`coordinator GetUserOrchardBalance failed: ${resp.errorMessage}`);
  }
  return {
    unspentZat: resp.unspentZat,
    noteCount: resp.noteCount,
    lastSeenHeight: resp.lastSeenHeight,
  };
}
