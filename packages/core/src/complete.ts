// `buildCompleteSigningWithPrecompile` — convenience helper that
// returns the per-operator precompile-verify ixes and the
// complete_signing ix together, pre-wired with the right `txIndex`.
// Avoids the "I forgot to add the precompile ix" class of bugs.
//
// For ECDSA assets (ETH, ZEC-T): pass one precompile input PER
// operator attestation — a real 5-of-7 round produces 5 secp256k1
// verifies, one per operator's I4 attestation over the canonical
// payload_hash. (The first SDK version only allowed a single
// precompile, which made the helper unusable for threshold rounds.)
//
// For FROST/RedDSA assets (BTC, Sapling): pass ed25519 attestation
// inputs — each operator brings one ed25519 verify.

import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import {
  buildCompleteSigningIx,
  type CompleteSigningArgs,
} from "./instructions.js";
import { buildSecp256k1VerifyIx, buildEd25519VerifyIx } from "./precompile.js";
import { SignatureFormat } from "./enums.js";

/// One operator's secp256k1 attestation over the round's I4 `payload_hash`.
export interface EcdsaPrecompileInput {
  ethAddress: Uint8Array;       // 20 bytes — operator's EVM-style address
  rawSignature64: Uint8Array;   // 64 bytes — r || s
  recoveryId: number;           // 0 or 1
  message: Uint8Array;          // 32 bytes — the I4 payload_hash
}

/// One operator's ed25519 attestation over the round's I4 `payload_hash`.
export interface Ed25519AttestationInput {
  pubkey: Uint8Array;     // 32 bytes
  signature: Uint8Array;  // 64 bytes
  message: Uint8Array;    // 32 bytes — the I4 payload_hash
}

export interface BuildCompleteSigningWithPrecompileArgs {
  programId: PublicKey;
  signingRequestPda: PublicKey;
  vaultPda: PublicKey;
  participatingOperators: boolean[];
  attemptIndex: number;
  roundId: Uint8Array;
  signatureFormat: SignatureFormat;
  signatureBlob: Uint8Array;       // 80 bytes (zero-padded)
  signatureLen: number;
  /// For ECDSA assets — one entry per participating operator.
  ecdsaAttestationInputs?: EcdsaPrecompileInput[];
  /// For FROST/RedDSA assets — one entry per participating operator.
  ed25519AttestationInputs?: Ed25519AttestationInput[];
  /// 0-based tx-level index where the FIRST returned precompile ix
  /// will be placed in the assembled transaction.
  ///
  /// Defaults to 0 — fine if you build the tx as
  /// `[...precompileIxes, completeSigningIx]` with nothing else.
  /// Set it explicitly when you prepend other instructions
  /// (e.g. `ComputeBudgetProgram.setComputeUnitPrice`): the
  /// secp256k1 precompile encodes a tx-level self-reference offset,
  /// and a mismatch silently produces an invalid precompile that
  /// reverts on-chain. (ed25519 is immune — it uses an
  /// "in-this-instruction" sentinel.)
  txOffset?: number;
}

export interface BuildCompleteSigningWithPrecompileResult {
  /// Submit these in order: all precompiles first, then completeSigning.
  precompileIxes: TransactionInstruction[];
  completeSigningIx: TransactionInstruction;
}

export function buildCompleteSigningWithPrecompile(
  args: BuildCompleteSigningWithPrecompileArgs,
): BuildCompleteSigningWithPrecompileResult {
  if (args.ecdsaAttestationInputs && args.ed25519AttestationInputs) {
    throw new Error(
      "pass either ecdsaAttestationInputs OR ed25519AttestationInputs, not both",
    );
  }
  if (!args.ecdsaAttestationInputs && !args.ed25519AttestationInputs) {
    throw new Error(
      "must pass at least one attestation array (ecdsa or ed25519)",
    );
  }

  const txOffset = args.txOffset ?? 0;
  if (!Number.isInteger(txOffset) || txOffset < 0 || txOffset > 254) {
    throw new Error(`txOffset out of range: ${txOffset}`);
  }

  const precompileIxes: TransactionInstruction[] = [];
  const attestationIxIndices: number[] = [];

  if (args.ecdsaAttestationInputs) {
    for (const att of args.ecdsaAttestationInputs) {
      if (att.ethAddress.length !== 20) {
        throw new Error(`ECDSA ethAddress must be 20 bytes, got ${att.ethAddress.length}`);
      }
      if (att.rawSignature64.length !== 64) {
        throw new Error(`ECDSA rawSignature64 must be 64 bytes, got ${att.rawSignature64.length}`);
      }
      const i = precompileIxes.length;
      precompileIxes.push(
        buildSecp256k1VerifyIx({
          ethAddress: att.ethAddress,
          signature: att.rawSignature64,
          recoveryId: att.recoveryId,
          message: att.message,
          txIndex: txOffset + i,
        }),
      );
      attestationIxIndices.push(txOffset + i);
    }
  }

  if (args.ed25519AttestationInputs) {
    for (const att of args.ed25519AttestationInputs) {
      const i = precompileIxes.length;
      precompileIxes.push(buildEd25519VerifyIx(att));
      attestationIxIndices.push(txOffset + i);
    }
  }

  const completeArgs: CompleteSigningArgs = {
    programId: args.programId,
    signingRequestPda: args.signingRequestPda,
    vaultPda: args.vaultPda,
    participatingOperators: args.participatingOperators,
    attemptIndex: args.attemptIndex,
    roundId: args.roundId,
    signatureFormat: args.signatureFormat,
    signatureBlob: args.signatureBlob,
    signatureLen: args.signatureLen,
    attestationIxIndices,
  };
  return {
    precompileIxes,
    completeSigningIx: buildCompleteSigningIx(completeArgs),
  };
}
