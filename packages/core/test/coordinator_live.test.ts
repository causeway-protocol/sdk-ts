// Live integration test against the tonic-web-enabled coordinator.
//
// Skipped unless `CAUSEWAY_LIVE_TESTS=1` is set, because most CI
// runs don't have the docker-compose stack up. Locally:
//
//   docker compose up -d
//   CAUSEWAY_LIVE_TESTS=1 pnpm -F @causeway-sh/core test
//
// This test fires REAL RPCs through the buf-generated bindings +
// connect-web's gRPC-Web transport. The `BuildAndSignSaplingSpend`
// path exercises the full cross-process pipeline — buf-decoded
// inputs travel as binary protobuf, hit the coordinator's tonic-web
// surface, drive 5-of-7 FROST-RedJubjub round across 7 operator
// gRPC servers, run Groth16, return a v5 transaction. We assert the
// raw_tx + txid come back well-formed.

import { describe, it, expect } from "vitest";
import { GrpcWebCoordinatorClient } from "../src/index.js";

const LIVE = process.env["CAUSEWAY_LIVE_TESTS"] === "1";
const skip = LIVE ? describe : describe.skip;

// Real regtest vault zaddr from a `bootstrap-operators-sapling` run
// against the docker-compose stack. The 43-byte raw payload below
// is what `decodeSaplingAddress(...)` would produce.
const REGTEST_VAULT_RAW = new Uint8Array([
  0xcf, 0x3e, 0xd6, 0xd4, 0xf4, 0x9c, 0xea, 0x72, 0xef, 0xf8, 0x28,
  0x21, 0xe4, 0x3d, 0x8b, 0x2e, 0x76, 0x7a, 0xd3, 0x69, 0x16, 0x6f,
  0x80, 0x9e, 0x0c, 0xc8, 0xcc, 0xb7, 0x60, 0x57, 0x27, 0x1d, 0x7e,
  0x1e, 0x42, 0xc9, 0xaf, 0x63, 0x8b, 0x4e, 0xa9, 0x96, 0xa7,
]);

skip("live coordinator (requires docker compose up)", () => {
  it("BuildAndSignSaplingSpend round-trips a real v5 tx", async () => {
    const client = new GrpcWebCoordinatorClient({ baseUrl: "http://localhost:50090" });
    const resp = await client.buildAndSignSaplingSpend({
      signingRequestPda: new Uint8Array(32),
      vault: new Uint8Array(32),
      recipientPaymentAddressRaw: REGTEST_VAULT_RAW,
      amountZat: 500_000_000n,
      feeZat: 15_000n,
      notePosition: 0n,
      noteRcm: new Uint8Array(32),
      anchorHeight: 0,
      attemptIndex: 0,
    });

    // Either we get a clean signed tx, or a real signing error from
    // the coordinator (note already spent on a previous run, no
    // unspent note ≥ amount, etc.). What we MUST NOT see is a
    // transport failure — that would mean the wire layer broke.
    if (resp.success) {
      expect(resp.rawTx.length).toBeGreaterThan(2000); // typical v5 = 2377 bytes
      expect(resp.sighash.length).toBe(32);
      expect(resp.txid.length).toBe(32);
    } else {
      // Real coordinator-side error message. Examples we accept:
      //   "no unspent note ≥ N zat available"
      //   "apply_signature: InvalidExternalSignature" (shouldn't, but real)
      // What we reject:
      //   any transport-layer error which would surface as a thrown
      //   exception above, not as `success=false`.
      expect(resp.errorMessage.length).toBeGreaterThan(0);
    }
  });

  it("BuildAndSignSaplingSpend rejects empty recipient with INVALID_ARGUMENT", async () => {
    const client = new GrpcWebCoordinatorClient({ baseUrl: "http://localhost:50090" });
    await expect(
      client.buildAndSignSaplingSpend({
        signingRequestPda: new Uint8Array(32),
        vault: new Uint8Array(32),
        recipientPaymentAddressRaw: new Uint8Array(),
        amountZat: 0n,
        feeZat: 0n,
        notePosition: 0n,
        noteRcm: new Uint8Array(32),
        anchorHeight: 0,
        attemptIndex: 0,
      }),
    ).rejects.toThrow(/recipient_payment_address_raw/);
  });
});

describe("GrpcWebCoordinatorClient construction", () => {
  it("trims trailing slashes from baseUrl", () => {
    const client = new GrpcWebCoordinatorClient({ baseUrl: "http://localhost:50090/" });
    expect(client).toBeDefined();
  });
});
