// Two-phase Orchard user spend orchestrator.
//
// Flow (mirror of the coordinator's `prepare → on-chain initiate →
// run → broadcast` design):
//
//   1. PrepareUserOrchardSpend
//      Coordinator builds the PCZT, runs Halo 2 (~12s), computes the
//      ZIP-244 v5 shielded sighash, stashes everything under a fresh
//      session id, returns (sessionId, sighash, anchorHeight).
//
//   2. (caller-side, NOT in this helper)
//      Caller commits to the sighash on-chain via
//      `tenant_demo::initiate_orchard_send` — this creates the
//      SigningRequest PDA the coordinator will reference at Run
//      time. Use `buildInitiateOrchardSend` from
//      `@causeway-sh/tenant` for the Solana ix.
//
//   3. RunOrchardSigningRound
//      Coordinator drives the FROST-RedPallas round, applies the
//      aggregated signature to the cached PCZT, finalises the v5
//      bundle. Returns the broadcast-ready raw_tx + txid + per-
//      operator I4 attestations.
//
//   4. BroadcastOrchardTx
//      Coordinator forwards raw_tx to lightwalletd `SendTransaction`,
//      returning the network-accepted txid (or a lwd_error_code on
//      mempool rejection).
//
// This helper drives steps 1, 3, and 4 in sequence — step 2 is
// caller-driven because it needs a signed Solana transaction the
// dApp's wallet must produce.

import type {
  CoordinatorClient,
  OperatorAttestation,
} from "@causeway-sh/core";

/// Caller-provided inputs for `prepareUserOrchard`. Maps 1:1 to the
/// `PrepareUserOrchardSpendRequest` proto.
export interface PrepareUserOrchardInput {
  coordinator: CoordinatorClient;
  vault: Uint8Array;
  /// 43-byte raw bech32m payload of the recipient's Orchard address.
  /// Use `decodeOrchardAddress(...).raw` to derive it.
  recipientPaymentAddressRaw: Uint8Array;
  amountZat: bigint;
  feeZat: bigint;
  /// 32-byte canonical derivation-path hash. Use
  /// `derivationPathHash(canonicalDerivationPath(segments))` from
  /// `@causeway-sh/core` to compute.
  derivationPathHash: Uint8Array;
  /// 32-byte tenant program id.
  tenantProgramId: Uint8Array;
  /// 32-byte user pubkey.
  userPubkey: Uint8Array;
}

export interface PrepareUserOrchardResult {
  /// 32-byte ZIP-244 v5 shielded sighash. Commit to this on-chain
  /// via `tenant_demo::initiate_orchard_send` before calling
  /// `runUserOrchard`.
  sighashToSign: Uint8Array;
  /// 16-byte session id. Pass back into `runUserOrchard`.
  sessionId: Uint8Array;
  /// Anchor height the coordinator pinned the PCZT against.
  anchorHeight: bigint;
}

export async function prepareUserOrchard(
  input: PrepareUserOrchardInput,
): Promise<PrepareUserOrchardResult> {
  if (input.recipientPaymentAddressRaw.length !== 43) {
    throw new Error(
      `recipientPaymentAddressRaw must be 43 bytes (got ${input.recipientPaymentAddressRaw.length})`,
    );
  }
  if (input.derivationPathHash.length !== 32) {
    throw new Error(
      `derivationPathHash must be 32 bytes (got ${input.derivationPathHash.length})`,
    );
  }
  if (input.tenantProgramId.length !== 32) {
    throw new Error(`tenantProgramId must be 32 bytes (got ${input.tenantProgramId.length})`);
  }
  if (input.userPubkey.length !== 32) {
    throw new Error(`userPubkey must be 32 bytes (got ${input.userPubkey.length})`);
  }
  const resp = await input.coordinator.prepareUserOrchardSpend({
    vault: input.vault,
    recipientPaymentAddressRaw: input.recipientPaymentAddressRaw,
    amountZat: input.amountZat,
    feeZat: input.feeZat,
    derivationPathHash: input.derivationPathHash,
    tenantProgramId: input.tenantProgramId,
    userPubkey: input.userPubkey,
  });
  if (!resp.success) {
    throw new Error(`coordinator PrepareUserOrchardSpend failed: ${resp.errorMessage}`);
  }
  if (resp.sighashToSign.length !== 32) {
    throw new Error(`coordinator returned sighash of ${resp.sighashToSign.length} bytes; want 32`);
  }
  if (resp.sessionId.length !== 16) {
    throw new Error(`coordinator returned session id of ${resp.sessionId.length} bytes; want 16`);
  }
  return {
    sighashToSign: resp.sighashToSign,
    sessionId: resp.sessionId,
    anchorHeight: resp.anchorHeight,
  };
}

export interface RunUserOrchardInput {
  coordinator: CoordinatorClient;
  /// 16-byte session id from `prepareUserOrchard`.
  sessionId: Uint8Array;
  /// 32-byte SigningRequest PDA — derived from the on-chain
  /// `initiate_orchard_send` ix the caller already issued.
  signingRequestPda: Uint8Array;
  vault: Uint8Array;
  derivationPathHash: Uint8Array;
  attemptIndex?: number;
  /// 7-bit bitmask of FROST participants. Defaults to 0b001_1111
  /// (operators 0–4) which matches the 5-of-7 threshold.
  participatingBitmask?: number;
}

export interface RunUserOrchardResult {
  /// 32-byte canonical round id.
  roundId: Uint8Array;
  /// 64-byte aggregated FROST-RedPallas spend-auth signature. Already
  /// applied to the v5 transaction in `rawTx`; surfaced here for
  /// logging / debugging.
  finalSignature: Uint8Array;
  /// Per-operator Ed25519 attestations over the I4 payload hash.
  attestations: OperatorAttestation[];
  /// Broadcast-ready v5 transaction bytes.
  rawTx: Uint8Array;
  /// 32-byte transaction id.
  txid: Uint8Array;
}

export async function runUserOrchard(
  input: RunUserOrchardInput,
): Promise<RunUserOrchardResult> {
  if (input.sessionId.length !== 16) {
    throw new Error(`sessionId must be 16 bytes (got ${input.sessionId.length})`);
  }
  if (input.signingRequestPda.length !== 32) {
    throw new Error(
      `signingRequestPda must be 32 bytes (got ${input.signingRequestPda.length})`,
    );
  }
  const resp = await input.coordinator.runOrchardSigningRound({
    sessionId: input.sessionId,
    signingRequestPda: input.signingRequestPda,
    vault: input.vault,
    derivationPathHash: input.derivationPathHash,
    attemptIndex: input.attemptIndex ?? 0,
    participatingBitmask: input.participatingBitmask,
  });
  if (!resp.success) {
    throw new Error(`coordinator RunOrchardSigningRound failed: ${resp.errorMessage}`);
  }
  if (resp.finalSignature.length !== 64) {
    throw new Error(
      `coordinator returned signature of ${resp.finalSignature.length} bytes; want 64`,
    );
  }
  return {
    roundId: resp.roundId,
    finalSignature: resp.finalSignature,
    attestations: resp.attestations,
    rawTx: resp.rawTx,
    txid: resp.txid,
  };
}

export interface BroadcastOrchardInput {
  coordinator: CoordinatorClient;
  rawTx: Uint8Array;
}

export interface BroadcastOrchardResult {
  /// 32-byte transaction id, computed locally by the coordinator
  /// from raw_tx (lightwalletd SendResponse doesn't return one).
  txid: Uint8Array;
  /// Non-zero lightwalletd error code on rejection. 0 on success.
  lwdErrorCode: number;
}

export async function broadcastOrchard(
  input: BroadcastOrchardInput,
): Promise<BroadcastOrchardResult> {
  const resp = await input.coordinator.broadcastOrchardTx({ rawTx: input.rawTx });
  if (!resp.success) {
    throw new Error(
      `coordinator BroadcastOrchardTx failed (lwd_error_code=${resp.lwdErrorCode}): ${resp.errorMessage}`,
    );
  }
  return {
    txid: resp.txid,
    lwdErrorCode: resp.lwdErrorCode,
  };
}

/// One-shot: take the txid returned by `runUserOrchard` and
/// broadcast the bundled rawTx. Equivalent to calling
/// `broadcastOrchard({ coordinator, rawTx: runResult.rawTx })`.
/// Exposed as a convenience because most callers want this exact
/// pairing.
export async function broadcastRunResult(
  coordinator: CoordinatorClient,
  runResult: RunUserOrchardResult,
): Promise<BroadcastOrchardResult> {
  return broadcastOrchard({ coordinator, rawTx: runResult.rawTx });
}
