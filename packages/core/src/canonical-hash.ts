// Canonical `round_id` (spec §8.1) and `payload_hash` (spec §7.2 / I4)
// hashes. These MUST stay byte-identical with the on-chain
// `programs/causeway/src/derivation_path.rs::compute_round_id` and
// `compute_payload_hash`.
//
// Every chain's `complete_signing` flow needs both: the coordinator
// returns operator attestations *over* `payload_hash`, and the
// program re-derives both round_id and payload_hash on chain to
// validate them — a one-byte mismatch produces `InvalidAttestation`
// with no actionable error surface.
//
// The Rust `Hasher::hash(slice)` API in solana-program is just a
// streaming SHA-256: `hash` appends `slice` to the digest. We mirror
// that with `@noble/hashes/sha256`'s streaming construction.

import { sha256 } from "@noble/hashes/sha256";
import { participatingOperatorsToByte } from "./derivation.js";

const TEXT = new TextEncoder();

/// Inputs to the canonical I4 `payload_hash`.
export interface ComputePayloadHashInput {
  signingRequestPda: Uint8Array;     // 32
  vault: Uint8Array;                 // 32
  tenant: Uint8Array;                // 32
  derivationPathHash: Uint8Array;    // 32
  sighashKind: number;               // u8 — SighashKind enum byte
  sighashToSign: Uint8Array;         // 32
  signatureFormat: number;           // u8 — SignatureFormat enum byte
  attemptIndex: number;              // u8
  participating: boolean[];          // 7 bools
  roundId: Uint8Array;               // 32
  isRotationDrain: boolean;
  destinationAddressHash: Uint8Array; // 32 (zero buffer ok)
  /// The active signature bytes (NOT the zero-padded 80-byte blob).
  /// For ECDSA recoverable: 65 bytes (r||s||v). For DER: variable.
  /// For ed25519: 64 bytes.
  signatureBlob: Uint8Array;
}

function check32(x: Uint8Array, name: string) {
  if (x.length !== 32) throw new Error(`${name} must be 32 bytes, got ${x.length}`);
}

/// Canonical `payload_hash` per spec §7.2 / Invariant I4.
///
/// This is the message every operator's attestation MUST cover.
/// Coordinator and program agree on the byte layout below; any drift
/// breaks all four `attestation == hash(payload)` checks in I1.
export function computePayloadHash(input: ComputePayloadHashInput): Uint8Array {
  check32(input.signingRequestPda, "signingRequestPda");
  check32(input.vault, "vault");
  check32(input.tenant, "tenant");
  check32(input.derivationPathHash, "derivationPathHash");
  check32(input.sighashToSign, "sighashToSign");
  check32(input.roundId, "roundId");
  check32(input.destinationAddressHash, "destinationAddressHash");

  const h = sha256.create();
  h.update(TEXT.encode("causeway:complete:v1"));
  h.update(input.signingRequestPda);
  h.update(input.vault);
  h.update(input.tenant);
  h.update(input.derivationPathHash);
  h.update(Uint8Array.of(input.sighashKind & 0xff));
  h.update(input.sighashToSign);
  h.update(Uint8Array.of(input.signatureFormat & 0xff));
  h.update(Uint8Array.of(input.attemptIndex & 0xff));
  h.update(Uint8Array.of(participatingOperatorsToByte(input.participating)));
  h.update(input.roundId);
  h.update(Uint8Array.of(input.isRotationDrain ? 1 : 0));
  h.update(input.destinationAddressHash);
  h.update(input.signatureBlob);
  return h.digest();
}

/// Inputs to the canonical `round_id`.
export interface ComputeRoundIdInput {
  signingRequestPda: Uint8Array;     // 32
  attemptIndex: number;              // u8
  participating: boolean[];          // 7 bools
  sighashToSign: Uint8Array;         // 32
  derivationPathHash: Uint8Array;    // 32
}

/// Canonical `round_id` per spec §8.1.
export function computeRoundId(input: ComputeRoundIdInput): Uint8Array {
  check32(input.signingRequestPda, "signingRequestPda");
  check32(input.sighashToSign, "sighashToSign");
  check32(input.derivationPathHash, "derivationPathHash");
  const h = sha256.create();
  h.update(TEXT.encode("causeway:round:v1"));
  h.update(input.signingRequestPda);
  h.update(Uint8Array.of(input.attemptIndex & 0xff));
  h.update(Uint8Array.of(participatingOperatorsToByte(input.participating)));
  h.update(input.sighashToSign);
  h.update(input.derivationPathHash);
  return h.digest();
}
