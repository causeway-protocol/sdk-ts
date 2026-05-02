// ZIP-244 v5 transparent sighash, hand-rolled in TypeScript.
// Single dep: @noble/hashes blake2b. Tree-shakeable, audited.
//
// Mirrors the Rust reference at
// `cli/src/commands/zec_tx.rs::compute_zip244_sighash`.

import { blake2b } from "@noble/hashes/blake2b";

export interface ZecSendPlan {
  prevOutpointTxid: Uint8Array;       // 32 bytes
  prevOutpointIndex: number;          // u32
  inputScriptPubkey: Uint8Array;
  inputValueZat: bigint;
  outputScriptPubkey: Uint8Array;
  outputValueZat: bigint;
  changeOutput?: { scriptPubkey: Uint8Array; valueZat: bigint };
  lockTime: number;                   // u32
  expiryHeight: number;               // u32
  consensusBranchId: number;          // u32
}

const V5_HEADER = 0x80000005;
const V5_VERSION_GROUP_ID = 0x26A7270A;

// ---- byte helpers --------------------------------------------------

function u32le(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n >>> 0, true);
  return b;
}

function i64le(v: bigint): Uint8Array {
  // For non-negative Zatoshis (max 2.1e15 < 2^63), i64 LE == u64 LE.
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigInt64(0, v, true);
  return b;
}

function compactSize(n: number): Uint8Array {
  if (n < 0xFD) return new Uint8Array([n]);
  if (n <= 0xFFFF) {
    const b = new Uint8Array(3);
    b[0] = 0xFD;
    new DataView(b.buffer).setUint16(1, n, true);
    return b;
  }
  if (n <= 0xFFFFFFFF) {
    const b = new Uint8Array(5);
    b[0] = 0xFE;
    new DataView(b.buffer).setUint32(1, n >>> 0, true);
    return b;
  }
  throw new Error("compactSize: u64 not supported (no use case in v5 single-input)");
}

function concat(...xs: Uint8Array[]): Uint8Array {
  const total = xs.reduce((a, x) => a + x.length, 0);
  const out = new Uint8Array(total);
  let i = 0;
  for (const x of xs) { out.set(x, i); i += x.length; }
  return out;
}

// ---- blake2b with personalization ---------------------------------

function pers(p: string, branchId?: number): Uint8Array {
  const enc = new TextEncoder().encode(p);
  if (branchId === undefined) {
    if (enc.length !== 16) throw new Error(`pers ${p} not 16 bytes (got ${enc.length})`);
    return enc;
  }
  // Variable form: 12-byte prefix + 4-byte LE branch_id (used for txid_root + auth_root).
  if (enc.length !== 12) throw new Error(`pers ${p} not 12 bytes (got ${enc.length})`);
  return concat(enc, u32le(branchId));
}

function h32(personalization: Uint8Array, data: Uint8Array): Uint8Array {
  return blake2b(data, { dkLen: 32, personalization });
}

// ---- build unsigned v5 bytes (matches build_unsigned_v5_bytes) ---

export function buildUnsignedV5Bytes(plan: ZecSendPlan): Uint8Array {
  const parts: Uint8Array[] = [
    u32le(V5_HEADER),
    u32le(V5_VERSION_GROUP_ID),
    u32le(plan.consensusBranchId),
    u32le(plan.lockTime),
    u32le(plan.expiryHeight),
    compactSize(1),                                // 1 input
    plan.prevOutpointTxid,
    u32le(plan.prevOutpointIndex),
    compactSize(0),                                // empty scriptSig
    u32le(0xFFFFFFFF),                             // sequence
    compactSize(plan.changeOutput ? 2 : 1),        // n outputs
    i64le(plan.outputValueZat),
    compactSize(plan.outputScriptPubkey.length),
    plan.outputScriptPubkey,
  ];
  if (plan.changeOutput) {
    parts.push(
      i64le(plan.changeOutput.valueZat),
      compactSize(plan.changeOutput.scriptPubkey.length),
      plan.changeOutput.scriptPubkey,
    );
  }
  parts.push(
    compactSize(0),                                // sapling spends
    compactSize(0),                                // sapling outputs
    compactSize(0),                                // orchard actions
  );
  return concat(...parts);
}

// ---- ZIP-244 transparent sighash ----------------------------------

// Header digest: version | version_group_id | consensus_branch_id | lock_time | expiry_height
function headerDigest(plan: ZecSendPlan): Uint8Array {
  const data = concat(
    u32le(V5_HEADER),
    u32le(V5_VERSION_GROUP_ID),
    u32le(plan.consensusBranchId),
    u32le(plan.lockTime),
    u32le(plan.expiryHeight),
  );
  return h32(pers("ZTxIdHeadersHash"), data);
}

// Empty bundles: standard "all-zeros" personalized sentinels.
function emptySaplingDigest(): Uint8Array {
  return h32(pers("ZTxIdSaplingHash"), new Uint8Array());
}
function emptyOrchardDigest(): Uint8Array {
  return h32(pers("ZTxIdOrchardHash"), new Uint8Array());
}

// Transparent sighash sub-trees per ZIP-244 §S.2.
// txin_sig_digest covers prevouts, sequences, outputs, txin (per-input).
function prevoutsSigDigest(plan: ZecSendPlan): Uint8Array {
  // Single input: 32 txid + 4 vout LE
  const data = concat(plan.prevOutpointTxid, u32le(plan.prevOutpointIndex));
  return h32(pers("ZTxIdPrevoutHash"), data);
}

function sequenceSigDigest(): Uint8Array {
  return h32(pers("ZTxIdSequencHash"), u32le(0xFFFFFFFF));
}

function outputsSigDigest(plan: ZecSendPlan): Uint8Array {
  let data = concat(
    i64le(plan.outputValueZat),
    compactSize(plan.outputScriptPubkey.length),
    plan.outputScriptPubkey,
  );
  if (plan.changeOutput) {
    data = concat(
      data,
      i64le(plan.changeOutput.valueZat),
      compactSize(plan.changeOutput.scriptPubkey.length),
      plan.changeOutput.scriptPubkey,
    );
  }
  return h32(pers("ZTxIdOutputsHash"), data);
}

function txinSigDigest(plan: ZecSendPlan): Uint8Array {
  // Per ZIP-244 §S.2g, per-input commit:
  //   prevout (32 txid + 4 vout LE)
  //   value (i64 LE)
  //   script_pubkey (compactSize len || bytes)
  //   sequence (u32 LE)
  // No hash_type here — that lives in the parent transparent_sig_digest.
  const data = concat(
    plan.prevOutpointTxid,
    u32le(plan.prevOutpointIndex),
    i64le(plan.inputValueZat),
    compactSize(plan.inputScriptPubkey.length),
    plan.inputScriptPubkey,
    u32le(0xFFFFFFFF),
  );
  return h32(pers("Zcash___TxInHash"), data);
}

// txdata_transparent_digest is the parent that the per-input txin
// digest plugs into. For the per-input sighash variant in ZIP-244 §S.4,
// we hash:  prevouts | amounts | scriptpubkeys | sequences | outputs | txin
// — but in v5 the canonical "transparent_sig_digest" uses the per-input
// path, which is:
//   blake2b("ZTxIdTranspaHash",
//     hash_type | prevouts_sig | amounts_sig | scriptpubkeys_sig
//       | sequences_sig | outputs_sig | txin_sig)
function amountsSigDigest(plan: ZecSendPlan): Uint8Array {
  return h32(pers("ZTxTrAmountsHash"), i64le(plan.inputValueZat));
}

function scriptpubkeysSigDigest(plan: ZecSendPlan): Uint8Array {
  const data = concat(
    compactSize(plan.inputScriptPubkey.length),
    plan.inputScriptPubkey,
  );
  return h32(pers("ZTxTrScriptsHash"), data);
}

function transparentSigDigest(plan: ZecSendPlan, hashType: number): Uint8Array {
  const data = concat(
    new Uint8Array([hashType]),     // hash_type (1 byte for SIGHASH_ALL = 0x01)
    prevoutsSigDigest(plan),
    amountsSigDigest(plan),
    scriptpubkeysSigDigest(plan),
    sequenceSigDigest(),
    outputsSigDigest(plan),
    txinSigDigest(plan),
  );
  return h32(pers("ZTxIdTranspaHash"), data);
}

// Top-level: txid_digest committing to header | transparent | sapling | orchard.
// Personalization is the variable form: 12 bytes "ZcashTxHash_" + branch_id LE.
export function computeZip244Sighash(
  plan: ZecSendPlan,
  hashType: number = 0x01, // SIGHASH_ALL
): Uint8Array {
  const data = concat(
    headerDigest(plan),
    transparentSigDigest(plan, hashType),
    emptySaplingDigest(),
    emptyOrchardDigest(),
  );
  return h32(pers("ZcashTxHash_", plan.consensusBranchId), data);
}
