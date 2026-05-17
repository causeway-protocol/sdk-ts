import { describe, it, expect } from "vitest";
import { PublicKey } from "@solana/web3.js";
import {
  SignatureFormat,
  buildCompleteSigningWithPrecompile,
} from "../src/index.js";

describe("buildCompleteSigningWithPrecompile", () => {
  it("ECDSA path: emits one secp256k1 precompile per operator attestation", () => {
    // 5-of-7 threshold: 5 operator attestations → 5 precompile ixs.
    const att = (seed: number) => ({
      ethAddress: new Uint8Array(20).fill(seed),
      rawSignature64: new Uint8Array(64).fill(seed),
      recoveryId: seed & 1,
      message: new Uint8Array(32).fill(seed),
    });
    const out = buildCompleteSigningWithPrecompile({
      programId: PublicKey.default,
      signingRequestPda: PublicKey.default,
      vaultPda: PublicKey.default,
      participatingOperators: [true, true, true, true, true, false, false],
      attemptIndex: 0,
      roundId: new Uint8Array(32),
      signatureFormat: SignatureFormat.EcdsaRecoverable65,
      signatureBlob: new Uint8Array(80),
      signatureLen: 65,
      ecdsaAttestationInputs: [att(1), att(2), att(3), att(4), att(5)],
    });
    expect(out.precompileIxes.length).toBe(5);
    expect(out.completeSigningIx).toBeDefined();
    // complete_signing has exactly 3 accounts (signing_request, vault, sysvar).
    expect(out.completeSigningIx.keys.length).toBe(3);
    // None of them are signers — `caller` was removed.
    expect(out.completeSigningIx.keys.every((k) => !k.isSigner)).toBe(true);
  });

  it("Schnorr/RedDSA path: emits N ed25519 attestation ixes", () => {
    const att = (seed: number) => ({
      pubkey: new Uint8Array(32).fill(seed),
      signature: new Uint8Array(64).fill(seed),
      message: new Uint8Array(32).fill(seed),
    });
    const out = buildCompleteSigningWithPrecompile({
      programId: PublicKey.default,
      signingRequestPda: PublicKey.default,
      vaultPda: PublicKey.default,
      participatingOperators: [true, true, true, true, true, false, false],
      attemptIndex: 0,
      roundId: new Uint8Array(32),
      signatureFormat: SignatureFormat.Schnorr64,
      signatureBlob: new Uint8Array(80),
      signatureLen: 64,
      ed25519AttestationInputs: [att(1), att(2), att(3), att(4), att(5)],
    });
    expect(out.precompileIxes.length).toBe(5);
  });

  it("rejects when neither attestation array is passed", () => {
    expect(() =>
      buildCompleteSigningWithPrecompile({
        programId: PublicKey.default,
        signingRequestPda: PublicKey.default,
        vaultPda: PublicKey.default,
        participatingOperators: [true, true, true, true, true, false, false],
        attemptIndex: 0,
        roundId: new Uint8Array(32),
        signatureFormat: SignatureFormat.EcdsaRecoverable65,
        signatureBlob: new Uint8Array(80),
        signatureLen: 65,
      }),
    ).toThrow();
  });

  it("rejects when both attestation arrays are passed", () => {
    expect(() =>
      buildCompleteSigningWithPrecompile({
        programId: PublicKey.default,
        signingRequestPda: PublicKey.default,
        vaultPda: PublicKey.default,
        participatingOperators: [true, true, true, true, true, false, false],
        attemptIndex: 0,
        roundId: new Uint8Array(32),
        signatureFormat: SignatureFormat.EcdsaRecoverable65,
        signatureBlob: new Uint8Array(80),
        signatureLen: 65,
        ecdsaAttestationInputs: [
          { ethAddress: new Uint8Array(20), rawSignature64: new Uint8Array(64), recoveryId: 0, message: new Uint8Array(32) },
        ],
        ed25519AttestationInputs: [
          { pubkey: new Uint8Array(32), signature: new Uint8Array(64), message: new Uint8Array(32) },
        ],
      }),
    ).toThrow();
  });
});
