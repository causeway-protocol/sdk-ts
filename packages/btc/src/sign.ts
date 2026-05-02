// Splice the 64-byte BIP-340 Schnorr signature into the input-0 witness.

import { Transaction } from "@scure/btc-signer";

export interface AssembleSignedTxArgs {
  tx: Transaction;
  /// 64-byte BIP-340 Schnorr signature over the BIP-341 sighash.
  schnorrSignature: Uint8Array;
}

/// Returns the raw signed-transaction bytes ready for `sendrawtransaction`.
export function assembleSignedTx(args: AssembleSignedTxArgs): Uint8Array {
  if (args.schnorrSignature.length !== 64) {
    throw new Error(`schnorr signature must be 64 bytes, got ${args.schnorrSignature.length}`);
  }
  const tx = args.tx;
  // Taproot key-spend witness is exactly the 64-byte signature (default
  // sighash type, omit the trailing sighash byte). `@scure/btc-signer`
  // exposes `updateInput` for finalizing the witness; for our minimal
  // shape we set it directly.
  tx.updateInput(0, { tapKeySig: args.schnorrSignature });
  tx.finalize();
  return tx.extract();
}
