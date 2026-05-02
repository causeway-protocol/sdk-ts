// Splice (r, s, v) from the threshold round into the EIP-1559 wire form.

import {
  toRlp,
  type Hex,
  hexToBytes,
  numberToHex,
  toHex,
} from "viem";
import type { BuildUnsignedTxArgs } from "./tx.js";

export interface AssembleSignedTxArgs {
  fields: BuildUnsignedTxArgs;
  r: Uint8Array;        // 32 bytes BE
  s: Uint8Array;        // 32 bytes BE (must be low-S normalized)
  v: number;            // 0 or 1 (parity)
}

/// Returns the signed EIP-2718 envelope `0x02 || rlp([...fields, v, r, s])`.
export function assembleSignedTx(args: AssembleSignedTxArgs): Uint8Array {
  if (args.r.length !== 32) throw new Error(`r must be 32 bytes, got ${args.r.length}`);
  if (args.s.length !== 32) throw new Error(`s must be 32 bytes, got ${args.s.length}`);
  if (args.v !== 0 && args.v !== 1) throw new Error(`v must be 0 or 1, got ${args.v}`);

  const f = args.fields;
  const rlpBody = toRlp([
    numberToHex(f.chainId),
    f.nonce === 0 ? ("0x" as Hex) : numberToHex(f.nonce),
    f.maxPriorityFeePerGas === 0n
      ? ("0x" as Hex)
      : numberToHex(f.maxPriorityFeePerGas),
    f.maxFeePerGas === 0n ? ("0x" as Hex) : numberToHex(f.maxFeePerGas),
    f.gasLimit === 0n ? ("0x" as Hex) : numberToHex(f.gasLimit),
    f.to,
    f.valueWei === 0n ? ("0x" as Hex) : numberToHex(f.valueWei),
    f.data && f.data.length > 0 ? toHex(f.data) : ("0x" as Hex),
    [], // access_list
    args.v === 0 ? ("0x" as Hex) : numberToHex(args.v),
    leftStripZeros(args.r),
    leftStripZeros(args.s),
  ]);
  const rlpBytes = hexToBytes(rlpBody);
  const out = new Uint8Array(rlpBytes.length + 1);
  out[0] = 0x02;
  out.set(rlpBytes, 1);
  return out;
}

function leftStripZeros(b: Uint8Array): Hex {
  let i = 0;
  while (i < b.length && b[i] === 0) i++;
  if (i === b.length) return "0x" as Hex;
  return toHex(b.slice(i));
}
