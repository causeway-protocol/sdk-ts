// Live integration test against the docker-compose stack.
//
// Skipped unless `CAUSEWAY_LIVE_TESTS=1`. Locally:
//
//   docker compose up -d
//   CAUSEWAY_LIVE_TESTS=1 pnpm -F @causeway-sh/orchard test
//
// Exercises every Orchard RPC we can reach without a Solana wallet:
//
//   1. fetchOrchardVaultAddress         — vault discovery
//   2. fetchUserOrchardAddress          — per-user diversifier derivation
//   3. fetchUserOrchardBalance          — note-scanner state read
//   4. prepareUserOrchard               — Halo 2 prove + ZIP-244 v5 sighash
//
// The Run + Broadcast phases require a SigningRequest PDA the
// coordinator looks up at FROST-round time, which means a real
// Solana wallet committing `initiate_orchard_send` on-chain — out of
// scope here. Prepare on its own is the heavy crypto path (~12s
// Halo 2); if it round-trips a 32-byte sighash + 16-byte session id
// then the SDK <-> coordinator wire format is verified end-to-end.

import { describe, it, expect } from "vitest";
import { GrpcWebCoordinatorClient } from "@causeway-sh/core";
import {
  decodeOrchardAddress,
  encodeOrchardAddress,
  fetchOrchardVaultAddress,
  fetchUserOrchardAddress,
  fetchUserOrchardBalance,
  prepareUserOrchard,
} from "../src/index.js";

const LIVE = process.env["CAUSEWAY_LIVE_TESTS"] === "1";
const skip = LIVE ? describe : describe.skip;

// Fixed dummy (tenant, user) so balance-by-diversifier returns the
// same notes across test runs. Both 32 bytes.
const TENANT_PROGRAM_ID = new Uint8Array(32).fill(0xaa);
const USER_PUBKEY = new Uint8Array(32).fill(0xbb);

skip("@causeway-sh/orchard live coordinator", () => {
  it("fetchOrchardVaultAddress returns a well-formed regtest address", async () => {
    const coordinator = new GrpcWebCoordinatorClient({
      baseUrl: "http://localhost:50090",
    });
    const vault = await fetchOrchardVaultAddress(coordinator);
    expect(vault.bech32m.startsWith("uorchardreg1")).toBe(true);
    expect(vault.parsed.network).toBe("regtest");
    expect(vault.parsed.raw.length).toBe(43);
    expect(vault.diversifier.length).toBe(11);
    // Diversifier is the first 11 bytes of the raw payload.
    expect(vault.diversifier).toEqual(vault.parsed.raw.slice(0, 11));
    // Bech32m round-trip cleanly.
    const reEncoded = encodeOrchardAddress(vault.parsed.network, vault.parsed.raw);
    expect(reEncoded).toBe(vault.bech32m);
  });

  it("fetchUserOrchardAddress produces a stable per-user diversifier", async () => {
    const coordinator = new GrpcWebCoordinatorClient({
      baseUrl: "http://localhost:50090",
    });
    const a = await fetchUserOrchardAddress(coordinator, {
      tenantProgramId: TENANT_PROGRAM_ID,
      userPubkey: USER_PUBKEY,
    });
    const b = await fetchUserOrchardAddress(coordinator, {
      tenantProgramId: TENANT_PROGRAM_ID,
      userPubkey: USER_PUBKEY,
    });
    // Deterministic: same (tenant, user) → same diversifier + bech32m.
    expect(a.diversifier).toEqual(b.diversifier);
    expect(a.bech32m).toBe(b.bech32m);
    expect(a.parsed.network).toBe("regtest");
    // Round-trip the address.
    const decoded = decodeOrchardAddress(a.bech32m);
    expect(decoded.raw).toEqual(a.parsed.raw);
    // Different user → different diversifier (i.e. the salt actually
    // varies on user_pubkey).
    const otherUser = await fetchUserOrchardAddress(coordinator, {
      tenantProgramId: TENANT_PROGRAM_ID,
      userPubkey: new Uint8Array(32).fill(0xcc),
    });
    expect(otherUser.diversifier).not.toEqual(a.diversifier);
  });

  it("fetchUserOrchardBalance returns a sane (possibly zero) balance", async () => {
    const coordinator = new GrpcWebCoordinatorClient({
      baseUrl: "http://localhost:50090",
    });
    const bal = await fetchUserOrchardBalance(coordinator, {
      tenantProgramId: TENANT_PROGRAM_ID,
      userPubkey: USER_PUBKEY,
    });
    // unspentZat can be 0 if no funded notes exist for this dummy
    // user; the assert is that the wire shape returned makes sense.
    expect(typeof bal.unspentZat).toBe("bigint");
    expect(bal.unspentZat).toBeGreaterThanOrEqual(0n);
    expect(bal.noteCount).toBeGreaterThanOrEqual(0);
    expect(typeof bal.lastSeenHeight).toBe("bigint");
    // Regtest scanner should be ahead of genesis.
    expect(bal.lastSeenHeight).toBeGreaterThan(0n);
  });

  it(
    "prepareUserOrchard either succeeds (sighash + session) or fails with a coordinator-level error",
    async () => {
      const coordinator = new GrpcWebCoordinatorClient({
        baseUrl: "http://localhost:50090",
      });
      const vault = await fetchOrchardVaultAddress(coordinator);
      try {
        const prep = await prepareUserOrchard({
          coordinator,
          vault: new Uint8Array(32), // dummy vault PDA — coordinator validates later
          recipientPaymentAddressRaw: vault.parsed.raw,
          amountZat: 100_000n,
          feeZat: 10_000n,
          derivationPathHash: new Uint8Array(32),
          tenantProgramId: TENANT_PROGRAM_ID,
          userPubkey: USER_PUBKEY,
        });
        // Happy path: coordinator built a real PCZT, ran Halo 2,
        // computed the sighash. Wire format passed end-to-end.
        expect(prep.sighashToSign.length).toBe(32);
        expect(prep.sessionId.length).toBe(16);
        expect(prep.anchorHeight).toBeGreaterThan(0n);
      } catch (e) {
        // Sad path: the dummy user has no funded notes, OR the
        // dummy vault PDA + path-hash get rejected upstream. Either
        // is a coordinator-level "thrown error" — the wire layer
        // itself worked, the request was just semantically invalid.
        // What we MUST NOT see is a transport error (network /
        // schema mismatch). All accepted error shapes here are
        // strings produced by the coordinator's PrepareUserOrchardSpend
        // handler.
        if (!(e instanceof Error)) throw e;
        expect(e.message).toMatch(
          /PrepareUserOrchardSpend failed|no unspent orchard note|anchor stale|amount \+ fee/,
        );
      }
    },
    60_000,
  );
});
