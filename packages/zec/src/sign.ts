// Splice `<DER+SIGHASH_ALL> <push 33 pubkey>` scriptSig into the
// canonical-empty input-0 slot of an unsigned v5 tx, producing a
// fully signed v5 transparent transaction.

import { secp256k1 } from "@noble/curves/secp256k1";

export interface AssembleSignedTxArgs {
  unsignedTxBytes: Uint8Array;
  /// DER-encoded ECDSA signature, low-S normalized. Typically 70-72
  /// bytes; must be ≤ 74 to fit in a single push opcode.
  derSignature: Uint8Array;
  /// 33-byte compressed pubkey that signed the sighash.
  compressedPubkey: Uint8Array;
}

export function assembleSignedTx(args: AssembleSignedTxArgs): Uint8Array {
  if (args.derSignature.length === 0) throw new Error("empty DER signature");
  if (args.compressedPubkey.length !== 33) {
    throw new Error(`compressed pubkey must be 33 bytes, got ${args.compressedPubkey.length}`);
  }
  const pushSigLen = args.derSignature.length + 1; // +1 for SIGHASH_ALL byte
  if (pushSigLen > 75) {
    throw new Error(`scriptSig push too long for plain push opcode: ${pushSigLen}`);
  }

  // ScriptSig: <push N> <DER || SIGHASH_ALL> <push 33> <compressed_pubkey>
  const scriptSig = new Uint8Array(1 + pushSigLen + 1 + 33);
  scriptSig[0] = pushSigLen;
  scriptSig.set(args.derSignature, 1);
  scriptSig[1 + args.derSignature.length] = 0x01; // SIGHASH_ALL
  scriptSig[1 + pushSigLen] = 33;
  scriptSig.set(args.compressedPubkey, 2 + pushSigLen);

  return spliceScriptsigIntoUnsignedV5(args.unsignedTxBytes, scriptSig);
}

/// Replace the canonical-empty (single 0x00) scriptSig at the input-0
/// slot of an unsigned v5 transparent tx with the provided scriptSig.
function spliceScriptsigIntoUnsignedV5(unsigned: Uint8Array, scriptSig: Uint8Array): Uint8Array {
  // v5 header (5 × u32 LE) = 20 bytes; tx_in_count compact-size = 0x01
  // single byte; input 0 = 32 prev_hash + 4 prev_index_LE; then the
  // scriptSig compact-size at offset 20+1+36 = 57.
  const SCRIPTSIG_LEN_OFFSET = 20 + 1 + 32 + 4;
  if (unsigned.length <= SCRIPTSIG_LEN_OFFSET) {
    throw new Error(`unsigned tx truncated at scriptSig offset ${SCRIPTSIG_LEN_OFFSET}`);
  }
  if (unsigned[SCRIPTSIG_LEN_OFFSET] !== 0) {
    throw new Error(
      `expected empty scriptSig (compact-size 0) at offset ${SCRIPTSIG_LEN_OFFSET}, ` +
        `got 0x${unsigned[SCRIPTSIG_LEN_OFFSET]!.toString(16)}`,
    );
  }

  const sizeBytes = compactSize(scriptSig.length);
  const out = new Uint8Array(
    unsigned.length - 1 + sizeBytes.length + scriptSig.length,
  );
  out.set(unsigned.subarray(0, SCRIPTSIG_LEN_OFFSET), 0);
  out.set(sizeBytes, SCRIPTSIG_LEN_OFFSET);
  out.set(scriptSig, SCRIPTSIG_LEN_OFFSET + sizeBytes.length);
  out.set(
    unsigned.subarray(SCRIPTSIG_LEN_OFFSET + 1),
    SCRIPTSIG_LEN_OFFSET + sizeBytes.length + scriptSig.length,
  );
  return out;
}

function compactSize(n: number): Uint8Array {
  if (n < 0xfd) return new Uint8Array([n]);
  if (n <= 0xffff) {
    const out = new Uint8Array(3);
    out[0] = 0xfd;
    new DataView(out.buffer).setUint16(1, n, true);
    return out;
  }
  if (n <= 0xffffffff) {
    const out = new Uint8Array(5);
    out[0] = 0xfe;
    new DataView(out.buffer).setUint32(1, n >>> 0, true);
    return out;
  }
  throw new Error("compactSize: u64 not used in single-input v5");
}

/// Normalize an ECDSA signature to low-S form (BIP-146); consensus
/// rejects high-S. Operators sometimes return high-S; this is the
/// canonicalisation step before splicing.
export function lowSNormalizeDer(der: Uint8Array): Uint8Array {
  const sig = secp256k1.Signature.fromDER(der);
  return sig.normalizeS().toDERRawBytes();
}
