// EIP-1559 unsigned tx + sighash via viem.

import { keccak_256 } from "@noble/hashes/sha3";
import {
  toRlp,
  type Hex,
  type Address,
  hexToBytes,
  numberToHex,
  toHex,
} from "viem";

export interface BuildUnsignedTxArgs {
  from: Address;
  to: Address;
  valueWei: bigint;
  gasLimit: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  nonce: number;
  chainId: number;
  data?: Uint8Array;
}

export interface UnsignedEvmTx {
  /// `0x02` envelope || RLP-encoded EIP-1559 tx body. `assembleSignedTx`
  /// re-uses this to produce the signed wire form.
  unsignedRlp: Uint8Array;
  /// 32-byte sighash to pass to the threshold round.
  sighash: Uint8Array;
  /// The fields, kept for downstream typed access.
  fields: BuildUnsignedTxArgs;
}

export function buildUnsignedTx(args: BuildUnsignedTxArgs): UnsignedEvmTx {
  void args.from; // not in EIP-1559 envelope; present for caller clarity.
  const rlpBody = toRlp([
    numberToHex(args.chainId),
    args.nonce === 0 ? ("0x" as Hex) : numberToHex(args.nonce),
    args.maxPriorityFeePerGas === 0n
      ? ("0x" as Hex)
      : numberToHex(args.maxPriorityFeePerGas),
    args.maxFeePerGas === 0n ? ("0x" as Hex) : numberToHex(args.maxFeePerGas),
    args.gasLimit === 0n ? ("0x" as Hex) : numberToHex(args.gasLimit),
    args.to,
    args.valueWei === 0n ? ("0x" as Hex) : numberToHex(args.valueWei),
    args.data && args.data.length > 0 ? toHex(args.data) : ("0x" as Hex),
    [], // access_list
  ]);
  const rlpBytes = hexToBytes(rlpBody);
  const envelope = new Uint8Array(rlpBytes.length + 1);
  envelope[0] = 0x02;
  envelope.set(rlpBytes, 1);
  const sighash = keccak_256(envelope);
  return {
    unsignedRlp: envelope,
    sighash,
    fields: args,
  };
}
