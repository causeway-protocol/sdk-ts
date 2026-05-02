// Combine `buildUnsignedV5Bytes` + `computeZip244Sighash` in one call.

import {
  buildUnsignedV5Bytes,
  computeZip244Sighash,
  type ZecSendPlan,
} from "./zip244.js";

export interface UnsignedZecTx {
  unsignedTxBytes: Uint8Array;
  sighash: Uint8Array;
}

export { ZecSendPlan, buildUnsignedV5Bytes, computeZip244Sighash } from "./zip244.js";

export function buildUnsignedTx(plan: ZecSendPlan): UnsignedZecTx {
  return {
    unsignedTxBytes: buildUnsignedV5Bytes(plan),
    sighash: computeZip244Sighash(plan),
  };
}

/// `OP_DUP OP_HASH160 PUSH20 <pkh> OP_EQUALVERIFY OP_CHECKSIG` — the
/// canonical P2PKH `scriptPubKey` for a transparent ZEC output.
export function p2pkhScriptPubkey(pkh: Uint8Array): Uint8Array {
  if (pkh.length !== 20) throw new Error(`pkh must be 20 bytes, got ${pkh.length}`);
  const out = new Uint8Array(25);
  out[0] = 0x76; // OP_DUP
  out[1] = 0xa9; // OP_HASH160
  out[2] = 0x14; // push 20
  out.set(pkh, 3);
  out[23] = 0x88; // OP_EQUALVERIFY
  out[24] = 0xac; // OP_CHECKSIG
  return out;
}
