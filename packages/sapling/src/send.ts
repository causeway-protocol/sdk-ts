// End-to-end Sapling send convenience.
//
// Drives the full flow:
//
//   1. Decode the bech32 recipient.
//   2. Call BuildAndSignSaplingSpend on the coordinator
//      (coordinator picks the note, builds PCZT, runs Groth16,
//      drives the FROST round, applies signatures, freezes).
//   3. Broadcast the returned raw_tx via zcashd's sendrawtransaction.
//
// The coordinator-side signature/proof material doesn't leave the
// daemon — the caller only ever sees the final raw_tx + txid.

import type { CoordinatorClient } from "@causeway-sh/core";
import { decodeSaplingAddress } from "./address.js";
import { sendRawTransaction, type ZcashdRpc } from "./zcashd.js";

export interface SendToZaddrInput {
  /// Live coordinator client (e.g. `new GrpcWebCoordinatorClient({...})`).
  coordinator: CoordinatorClient;
  /// zcashd RPC endpoint to broadcast to.
  zcashdRpc: ZcashdRpc;
  /// Recipient bech32 z-address (zs1… / ztestsapling1… / zregtestsapling1…).
  to: string;
  amountZat: bigint;
  feeZat: bigint;
  /// Optional 32-byte SigningRequest PDA. Pass zeros for the direct
  /// off-chain flow (M2.0 demo); pass a real PDA once the on-chain
  /// audit trail wiring lands.
  signingRequestPda?: Uint8Array;
  /// Optional 32-byte vault PDA. Same caveat as signingRequestPda.
  vault?: Uint8Array;
  /// Bitmask of operators that must participate. Defaults to 5-of-7
  /// (operators 0..=4).
  participatingBitmask?: number;
}

export interface SendToZaddrResult {
  /// 32-byte ZIP-244 shielded sighash returned by the coordinator.
  sighash: Uint8Array;
  /// 32-byte transaction id (computed coordinator-side; matches the
  /// txid zcashd returns from sendrawtransaction).
  txid: Uint8Array;
  /// Same txid as a hex string, ready for block-explorer links.
  txidHex: string;
  /// txid string returned by zcashd's sendrawtransaction.
  broadcastTxid: string;
  /// Raw v5 transaction bytes. Returned for callers who want to log
  /// or re-broadcast.
  rawTx: Uint8Array;
}

function bytesToHex(b: Uint8Array): string {
  let s = "";
  for (const byte of b) s += byte.toString(16).padStart(2, "0");
  return s;
}

export async function sendToZaddr(input: SendToZaddrInput): Promise<SendToZaddrResult> {
  const recipient = decodeSaplingAddress(input.to);
  const resp = await input.coordinator.buildAndSignSaplingSpend({
    signingRequestPda: input.signingRequestPda ?? new Uint8Array(32),
    vault: input.vault ?? new Uint8Array(32),
    recipientPaymentAddressRaw: recipient.raw,
    amountZat: input.amountZat,
    feeZat: input.feeZat,
    notePosition: 0n,
    noteRcm: new Uint8Array(32),
    anchorHeight: 0,
    attemptIndex: 0,
    participatingBitmask: input.participatingBitmask ?? 0b001_1111,
  });
  if (!resp.success) {
    throw new Error(`coordinator BuildAndSignSaplingSpend failed: ${resp.errorMessage}`);
  }
  const broadcastTxid = await sendRawTransaction(input.zcashdRpc, resp.rawTx);
  return {
    sighash: resp.sighash,
    txid: resp.txid,
    txidHex: bytesToHex(resp.txid),
    broadcastTxid,
    rawTx: resp.rawTx,
  };
}
