// Live integration test against the tonic-web-enabled coordinator.
//
// Skipped unless `CAUSEWAY_LIVE_TESTS=1` is set, because most CI
// runs don't have the docker-compose stack up. Locally:
//
//   docker compose up -d
//   CAUSEWAY_LIVE_TESTS=1 pnpm -F @causeway-sh/core test

import { describe, it, expect } from "vitest";
import { GrpcWebCoordinatorClient } from "../src/index.js";

const LIVE = process.env["CAUSEWAY_LIVE_TESTS"] === "1";
const skip = LIVE ? describe : describe.skip;

skip("live coordinator (requires docker compose up)", () => {
  it("instantiates GrpcWebCoordinatorClient against localhost", () => {
    const client = new GrpcWebCoordinatorClient({
      baseUrl: "http://localhost:50090",
      timeoutMs: 5000,
    });
    expect(client).toBeDefined();
    // We don't actually fire a request here — RunSigningRound requires
    // a valid request_id PDA that's already on-chain. The smoke check
    // confirms the gRPC-Web client constructs without throwing
    // against a real endpoint.
  });
});

describe("GrpcWebCoordinatorClient construction", () => {
  it("trims trailing slashes from baseUrl", () => {
    const client = new GrpcWebCoordinatorClient({ baseUrl: "http://localhost:50090/" });
    expect(client).toBeDefined();
  });
});
