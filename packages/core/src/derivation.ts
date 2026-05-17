// Canonical derivation-path encoding + hash. Spec §6.5 / on-chain
// `programs/causeway/src/derivation_path.rs`.
//
// IMPORTANT: this MUST stay byte-identical with the on-chain
// implementation — any drift breaks user address derivation and the
// PDA seed derivations the program checks.

import { sha256 } from "@noble/hashes/sha256";

/// At most this many segments per derivation path (M1 freeze).
export const DERIVATION_PATH_MAX_SEGMENTS = 4;
/// At most this many bytes per segment.
export const DERIVATION_PATH_MAX_SEGMENT_LEN = 32;
/// On-chain fixed-size buffer: 1 (len) + 4 × (1 + 32) = 133.
export const DERIVATION_PATH_MAX_LEN = 133;

/// Result of `canonicalDerivationPath`.
///
/// `bytes` is zero-padded to `DERIVATION_PATH_MAX_LEN`; only the first
/// `len` bytes are meaningful. The hash is taken over the first
/// `len` bytes only — NOT the whole padded buffer.
export interface CanonicalDerivationPath {
  bytes: Uint8Array; // length = DERIVATION_PATH_MAX_LEN, zero-padded
  len: number;       // active prefix length in bytes
}

/// Canonically encode a derivation path:
///
///     len_u8 || (seg_len_u8 || seg_bytes)*
///
/// Throws if there are too many segments, or any segment exceeds
/// `DERIVATION_PATH_MAX_SEGMENT_LEN`. The empty path is valid and
/// encodes to a single zero byte.
export function canonicalDerivationPath(
  segments: Uint8Array[],
): CanonicalDerivationPath {
  if (segments.length > DERIVATION_PATH_MAX_SEGMENTS) {
    throw new Error(
      `derivation path has ${segments.length} segments, max is ${DERIVATION_PATH_MAX_SEGMENTS}`,
    );
  }
  const out = new Uint8Array(DERIVATION_PATH_MAX_LEN);
  let cursor = 0;
  out[cursor++] = segments.length;
  for (const seg of segments) {
    if (seg.length > DERIVATION_PATH_MAX_SEGMENT_LEN) {
      throw new Error(
        `derivation path segment has ${seg.length} bytes, max is ${DERIVATION_PATH_MAX_SEGMENT_LEN}`,
      );
    }
    out[cursor++] = seg.length;
    out.set(seg, cursor);
    cursor += seg.length;
  }
  return { bytes: out, len: cursor };
}

/// SHA-256 of the canonical encoding restricted to its active length.
///
/// Hashing the *padded* bytes would change with the padding constant
/// and would not match the on-chain hash.
export function derivationPathHash(
  canonical: CanonicalDerivationPath,
): Uint8Array {
  return sha256(canonical.bytes.subarray(0, canonical.len));
}

/// Convenience: take raw segments, return their canonical hash. Equivalent to
/// `derivationPathHash(canonicalDerivationPath(segments))`.
export function hashDerivationPathSegments(
  segments: Uint8Array[],
): Uint8Array {
  return derivationPathHash(canonicalDerivationPath(segments));
}

/// The canonical encoding's ACTIVE prefix (no zero padding).
///
/// This is the form most consumers want: it's what the on-chain
/// `applyTweak` math hashes, and the form passed to
/// `deriveVaultAddress` etc. Use the `.bytes` (padded) form only when
/// you need to round-trip through a `[u8; 133]` storage slot.
export function canonicalDerivationPathBytes(
  segments: Uint8Array[],
): Uint8Array {
  const c = canonicalDerivationPath(segments);
  return c.bytes.subarray(0, c.len);
}

/// Encode the 7-bool participating-operators bitmask as a single byte.
/// Bit `i` (LSB-first) is set iff operator `i` participates. The byte
/// is a load-bearing input to `round_id` and `payload_hash` and must
/// be byte-identical across every implementation.
export function participatingOperatorsToByte(bits: boolean[]): number {
  if (bits.length !== 7) {
    throw new Error(`participating operators must be exactly 7 bools, got ${bits.length}`);
  }
  let byte = 0;
  for (let i = 0; i < 7; i++) {
    if (bits[i]) byte |= 1 << i;
  }
  return byte;
}

/// Inverse of `participatingOperatorsToByte`. Bit `i` (LSB-first) maps
/// to `bools[i]`. Returns exactly 7 bools.
export function participatingOperatorsFromByte(byte: number): boolean[] {
  const out: boolean[] = [];
  for (let i = 0; i < 7; i++) out.push((byte & (1 << i)) !== 0);
  return out;
}
