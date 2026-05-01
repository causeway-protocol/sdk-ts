// Solana built-in precompile instruction builders. Used inside the
// `complete_signing` ix sequence: the program walks Sysvar::Instructions
// and matches each precompile entry against the operators' attested
// signatures.
//
// Mirrors `cli/src/solana_tx.rs::build_secp256k1_verify_ix` /
// `build_ed25519_verify_ix` byte-for-byte.

import { PublicKey, TransactionInstruction } from "@solana/web3.js";

const SECP256K1_PROGRAM_ID = new PublicKey("KeccakSecp256k11111111111111111111111111111");
const ED25519_PROGRAM_ID = new PublicKey("Ed25519SigVerify111111111111111111111111111");

export interface BuildSecp256k1VerifyIxArgs {
  ethAddress: Uint8Array;     // 20 bytes
  signature: Uint8Array;      // 64 bytes (r || s)
  recoveryId: number;         // 0 or 1
  message: Uint8Array;        // arbitrary; the precompile keccak256s it
  /// 0-based index this instruction will occupy in the assembled tx.
  /// MUST be set correctly — Solana rejects u8::MAX as out-of-bounds
  /// for secp256k1 (unlike ed25519's "same-ix" sentinel).
  txIndex: number;
}

export function buildSecp256k1VerifyIx(args: BuildSecp256k1VerifyIxArgs): TransactionInstruction {
  if (args.ethAddress.length !== 20) throw new Error(`ethAddress must be 20 bytes, got ${args.ethAddress.length}`);
  if (args.signature.length !== 64)  throw new Error(`signature must be 64 bytes, got ${args.signature.length}`);
  if (args.recoveryId !== 0 && args.recoveryId !== 1) {
    throw new Error(`recoveryId must be 0 or 1, got ${args.recoveryId}`);
  }
  if (!Number.isInteger(args.txIndex) || args.txIndex < 0 || args.txIndex > 254) {
    throw new Error(`txIndex out of range: ${args.txIndex}`);
  }

  const HEADER_LEN = 1;
  const OFFSETS_LEN = 11;
  const ADDR_LEN = 20;
  const SIG_LEN = 64;
  const RECID_LEN = 1;
  const total = HEADER_LEN + OFFSETS_LEN + ADDR_LEN + SIG_LEN + RECID_LEN + args.message.length;

  const data = new Uint8Array(total);
  const view = new DataView(data.buffer);
  data[0] = 1; // num_signatures

  const ethAddressOffset = HEADER_LEN + OFFSETS_LEN;
  const signatureOffset  = ethAddressOffset + ADDR_LEN;
  const messageOffset    = signatureOffset + SIG_LEN + RECID_LEN;

  view.setUint16(1, signatureOffset, true);
  data[3] = args.txIndex;
  view.setUint16(4, ethAddressOffset, true);
  data[6] = args.txIndex;
  view.setUint16(7, messageOffset, true);
  view.setUint16(9, args.message.length, true);
  data[11] = args.txIndex;

  data.set(args.ethAddress, ethAddressOffset);
  data.set(args.signature, signatureOffset);
  data[signatureOffset + SIG_LEN] = args.recoveryId;
  data.set(args.message, messageOffset);

  return new TransactionInstruction({
    programId: SECP256K1_PROGRAM_ID,
    keys: [],
    data: Buffer.from(data),
  });
}

export interface BuildEd25519VerifyIxArgs {
  pubkey: Uint8Array;     // 32 bytes
  signature: Uint8Array;  // 64 bytes
  message: Uint8Array;
}

export function buildEd25519VerifyIx(args: BuildEd25519VerifyIxArgs): TransactionInstruction {
  if (args.pubkey.length !== 32)    throw new Error(`pubkey must be 32 bytes, got ${args.pubkey.length}`);
  if (args.signature.length !== 64) throw new Error(`signature must be 64 bytes, got ${args.signature.length}`);

  const SAME_INSTRUCTION = 0xFFFF;
  const HEADER_LEN = 2;
  const OFFSETS_LEN = 14;
  const PUBKEY_LEN = 32;
  const SIGNATURE_LEN = 64;
  const total = HEADER_LEN + OFFSETS_LEN + PUBKEY_LEN + SIGNATURE_LEN + args.message.length;

  const data = new Uint8Array(total);
  const view = new DataView(data.buffer);
  data[0] = 1;
  data[1] = 0;

  const pubkeyOffset    = HEADER_LEN + OFFSETS_LEN;
  const signatureOffset = pubkeyOffset + PUBKEY_LEN;
  const messageOffset   = signatureOffset + SIGNATURE_LEN;

  view.setUint16(2, signatureOffset, true);
  view.setUint16(4, SAME_INSTRUCTION, true);
  view.setUint16(6, pubkeyOffset, true);
  view.setUint16(8, SAME_INSTRUCTION, true);
  view.setUint16(10, messageOffset, true);
  view.setUint16(12, args.message.length, true);
  view.setUint16(14, SAME_INSTRUCTION, true);

  data.set(args.pubkey, pubkeyOffset);
  data.set(args.signature, signatureOffset);
  data.set(args.message, messageOffset);

  return new TransactionInstruction({
    programId: ED25519_PROGRAM_ID,
    keys: [],
    data: Buffer.from(data),
  });
}
