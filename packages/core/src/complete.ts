// `buildCompleteSigningWithPrecompile` — convenience helper that
// returns the precompile-verify ix and the complete_signing ix
// together, pre-wired with the right `txIndex`. Avoids the
// "I forgot to add the precompile ix" class of bugs surfaced in
// spike C.

import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import {
  buildCompleteSigningIx,
  type CompleteSigningArgs,
} from "./instructions.js";
import { buildSecp256k1VerifyIx, buildEd25519VerifyIx } from "./precompile.js";
import { SignatureFormat } from "./enums.js";

export interface BuildCompleteSigningWithPrecompileArgs {
  programId: PublicKey;
  signingRequestPda: PublicKey;
  vaultPda: PublicKey;
  caller: PublicKey;
  participatingOperators: boolean[];
  attemptIndex: number;
  roundId: Uint8Array;
  signatureFormat: SignatureFormat;
  signatureBlob: Uint8Array;       // 80 bytes (zero-padded)
  signatureLen: number;
  /// For ECDSA assets only (`EcdsaRecoverable65` / `EcdsaDer`):
  /// the 20-byte EVM-style address of the threshold-signed message,
  /// the recovered signature components, and the recovery id.
  /// Pass `undefined` for FROST/RedDSA assets — they use the ed25519
  /// attestation path, where each operator brings their own ed25519
  /// `verify` ix and there's no per-message precompile to spawn here.
  ecdsaPrecompileInputs?: {
    ethAddress: Uint8Array;
    rawSignature64: Uint8Array;
    recoveryId: number;
    message: Uint8Array;
  };
  /// For Schnorr/RedDSA assets — the operator-side ed25519 attestations
  /// over the I4 payload hash. Each entry produces one ed25519 verify
  /// ix in the assembled tx.
  ed25519AttestationInputs?: Array<{
    pubkey: Uint8Array;
    signature: Uint8Array;
    message: Uint8Array;
  }>;
  /// Position the assembled `complete_signing` ix will occupy in the
  /// outer transaction. Used to tell the secp256k1 precompile which
  /// ix index to read its inputs from. Default: precompiles come
  /// before complete_signing, so completeSigningIxIndex = N (where N
  /// = number of precompile ixes).
  completeSigningIxIndex?: number;
}

export interface BuildCompleteSigningWithPrecompileResult {
  /// Submit these in order: all precompiles first, then completeSigning.
  precompileIxes: TransactionInstruction[];
  completeSigningIx: TransactionInstruction;
}

export function buildCompleteSigningWithPrecompile(
  args: BuildCompleteSigningWithPrecompileArgs,
): BuildCompleteSigningWithPrecompileResult {
  const precompileIxes: TransactionInstruction[] = [];
  const attestationIxIndices: number[] = [];

  if (args.ecdsaPrecompileInputs) {
    const i = precompileIxes.length;
    precompileIxes.push(
      buildSecp256k1VerifyIx({
        ethAddress: args.ecdsaPrecompileInputs.ethAddress,
        signature: args.ecdsaPrecompileInputs.rawSignature64,
        recoveryId: args.ecdsaPrecompileInputs.recoveryId,
        message: args.ecdsaPrecompileInputs.message,
        txIndex: i,
      }),
    );
    attestationIxIndices.push(i);
  }

  if (args.ed25519AttestationInputs) {
    for (const att of args.ed25519AttestationInputs) {
      const i = precompileIxes.length;
      precompileIxes.push(buildEd25519VerifyIx(att));
      attestationIxIndices.push(i);
    }
  }

  const completeArgs: CompleteSigningArgs = {
    programId: args.programId,
    signingRequestPda: args.signingRequestPda,
    vaultPda: args.vaultPda,
    caller: args.caller,
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
