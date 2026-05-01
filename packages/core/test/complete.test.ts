import { describe, it, expect } from "vitest";
import { PublicKey } from "@solana/web3.js";
import {
  SignatureFormat,
  buildCompleteSigningWithPrecompile,
} from "../src/index.js";

describe("buildCompleteSigningWithPrecompile", () => {
  it("ECDSA path: precompile is at index 0, complete_signing references it", () => {
    const out = buildCompleteSigningWithPrecompile({
      programId: PublicKey.default,
      signingRequestPda: PublicKey.default,
      vaultPda: PublicKey.default,
      caller: PublicKey.default,
      participatingOperators: [true, true, true, true, true, false, false],
      attemptIndex: 0,
      roundId: new Uint8Array(32),
      signatureFormat: SignatureFormat.EcdsaRecoverable65,
      signatureBlob: new Uint8Array(80),
      signatureLen: 65,
      ecdsaPrecompileInputs: {
        ethAddress: new Uint8Array(20),
        rawSignature64: new Uint8Array(64),
        recoveryId: 0,
        message: new Uint8Array(32),
      },
    });
    expect(out.precompileIxes.length).toBe(1);
    expect(out.completeSigningIx).toBeDefined();
  });

  it("Schnorr/RedDSA path: produces N ed25519 attestation ixes for N operators", () => {
    const att = (seed: number) => ({
      pubkey: new Uint8Array(32).fill(seed),
      signature: new Uint8Array(64).fill(seed),
      message: new Uint8Array(32).fill(seed),
    });
    const out = buildCompleteSigningWithPrecompile({
      programId: PublicKey.default,
      signingRequestPda: PublicKey.default,
      vaultPda: PublicKey.default,
      caller: PublicKey.default,
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
});
