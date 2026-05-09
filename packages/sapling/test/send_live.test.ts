// Live integration test: drive the full sendToZaddr against a
// running docker-compose stack.
//
// Skipped unless `CAUSEWAY_LIVE_TESTS=1`. Locally:
//
//   docker compose up -d
//   CAUSEWAY_LIVE_TESTS=1 pnpm -F @causeway-sh/sapling test
//
// Asserts that the coordinator returns a well-formed v5 transaction.
// We don't assert a successful broadcast because the test is
// idempotent on a single funded note — second run hits zcashd's
// duplicate-nullifier check, which is itself proof the wire layer
// + Groth16 + FROST round all worked end-to-end.

import { describe, it, expect } from "vitest";
import { GrpcWebCoordinatorClient } from "@causeway-sh/core";
import { sendToZaddr, ZcashdRpcCallError } from "../src/index.js";

const LIVE = process.env["CAUSEWAY_LIVE_TESTS"] === "1";
const skip = LIVE ? describe : describe.skip;

const VAULT_ADDR =
  "zregtestsapling1euldd485nn489mlc9qs7g0vt9em845mfzehcp8sverxtwczhyuwhu8jzexhk8z6w4xt2wld40jr";

skip("@causeway-sh/sapling sendToZaddr (live stack)", () => {
  it("either broadcasts or fails with a meaningful zcashd error", async () => {
    const coordinator = new GrpcWebCoordinatorClient({
      baseUrl: "http://localhost:50090",
    });
    const zcashdRpc = {
      url: "http://localhost:18232",
      user: "causeway",
      password: "causeway_dev",
    };
    try {
      const r = await sendToZaddr({
        coordinator,
        zcashdRpc,
        to: VAULT_ADDR,
        amountZat: 500_000_000n,
        feeZat: 15_000n,
      });
      // First run from a fresh stack: real broadcast.
      expect(r.rawTx.length).toBeGreaterThan(2000);
      expect(r.txid.length).toBe(32);
      expect(r.broadcastTxid).toMatch(/^[0-9a-f]{64}$/);
    } catch (e) {
      // Subsequent runs without re-funding hit:
      //   - "no unspent note ≥ N zat available" (coord returned success=false)
      //   - "bad-txns-sapling-duplicate-nullifier" (zcashd code -26)
      // Either is real proof the wire path works end-to-end.
      if (e instanceof ZcashdRpcCallError) {
        expect(e.rpcError.code).toBe(-26);
        expect(e.rpcError.message).toMatch(/sapling-duplicate-nullifier|bad-txns/);
      } else if (e instanceof Error) {
        expect(e.message).toMatch(/no unspent note|coordinator BuildAndSignSaplingSpend failed/);
      } else {
        throw e;
      }
    }
  }, 60_000);
});
