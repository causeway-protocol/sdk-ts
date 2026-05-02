// BIP-341 sighash for the M1.0 single-input single-output P2TR send.
//
// Production wallets need multi-input UTXO selection, sat-per-vbyte
// fee estimation, RBF, etc. v0.1 ships the minimum primitive — the
// 32-byte sighash the threshold round signs over.

import * as btc from "@scure/btc-signer";
import { Transaction } from "@scure/btc-signer";

export interface BtcSendPlan {
  /// Prevout the vault is spending.
  prevout: {
    txid: Uint8Array;       // 32 bytes (display order)
    vout: number;
    valueSat: bigint;
    /// 34-byte P2TR scriptPubkey: `0x51 0x20 || <32-byte output key>`.
    scriptPubkey: Uint8Array;
  };
  /// Recipient (P2TR address string for now; v0.2 will accept the
  /// 34-byte scriptPubkey directly).
  recipientScriptPubkey: Uint8Array;
  /// Amount to send (sat). Must be ≤ `prevout.valueSat - fee_sat`.
  amountSat: bigint;
  feeSat: bigint;
}

export interface UnsignedBtcTx {
  /// The Transaction object, kept for downstream typed access (witness
  /// splice in `assembleSignedTx`).
  tx: Transaction;
  /// 32-byte BIP-341 key-spend sighash (default sighash type).
  sighash: Uint8Array;
}

export function buildUnsignedTx(plan: BtcSendPlan): UnsignedBtcTx {
  if (plan.prevout.txid.length !== 32) throw new Error(`txid must be 32 bytes`);
  const tx = new Transaction({ allowUnknownInputs: true, allowUnknownOutputs: true });
  tx.addInput({
    txid: plan.prevout.txid,
    index: plan.prevout.vout,
    witnessUtxo: {
      script: plan.prevout.scriptPubkey,
      amount: plan.prevout.valueSat,
    },
  });
  tx.addOutput({
    script: plan.recipientScriptPubkey,
    amount: plan.amountSat,
  });
  // Implicit change/fee: M1.0 shape is single-output; the difference
  // between input value and output amount is the fee. Caller must set
  // amountSat = prevout.valueSat - feeSat.
  void plan.feeSat;
  // BIP-341 key-spend default-sighash digest.
  const sighash = tx.preimageWitnessV1(0, [plan.prevout.scriptPubkey], btc.SigHash.DEFAULT, [plan.prevout.valueSat]);
  return { tx, sighash };
}
