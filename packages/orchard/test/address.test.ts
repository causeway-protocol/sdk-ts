// Bech32m round-trip + payload-length tests for Orchard addresses.

import { describe, it, expect } from "vitest";
import { bech32m } from "@scure/base";
import {
  decodeOrchardAddress,
  encodeOrchardAddress,
  networkFromCoordinator,
} from "../src/index.js";

// Construct a fixture payload at test time. 43 bytes:
// 11 diversifier + 32 pk_d. The exact contents don't matter for
// codec round-tripping; we just need a known input we can compare
// the re-encoded output against.
const FIXTURE_RAW = (() => {
  const buf = new Uint8Array(43);
  for (let i = 0; i < 43; i++) buf[i] = (i * 7 + 3) & 0xff;
  return buf;
})();

describe("@causeway-sh/orchard address", () => {
  it("round-trips a regtest Orchard address byte-identically", () => {
    const encoded = encodeOrchardAddress("regtest", FIXTURE_RAW);
    expect(encoded.startsWith("uorchardreg1")).toBe(true);
    const parsed = decodeOrchardAddress(encoded);
    expect(parsed.network).toBe("regtest");
    expect(parsed.raw).toEqual(FIXTURE_RAW);
    expect(encodeOrchardAddress(parsed.network, parsed.raw)).toBe(encoded);
  });

  it("round-trips testnet + mainnet HRPs", () => {
    for (const network of ["mainnet", "testnet", "regtest"] as const) {
      const enc = encodeOrchardAddress(network, FIXTURE_RAW);
      const dec = decodeOrchardAddress(enc);
      expect(dec.network).toBe(network);
      expect(dec.raw).toEqual(FIXTURE_RAW);
    }
  });

  it("rejects a wrong payload length on encode", () => {
    expect(() => encodeOrchardAddress("regtest", new Uint8Array(42))).toThrow(/43 bytes/);
  });

  it("rejects an unknown hrp", () => {
    // Build a syntactically valid bech32m string with a non-Orchard
    // HRP (using a 43-byte payload so we'd get past the length
    // check) — decoder must fail-closed at the HRP check.
    const wrongHrp = bech32m.encode(
      "foobar" as `${string}`,
      bech32m.toWords(FIXTURE_RAW),
      1023,
    );
    expect(() => decodeOrchardAddress(wrongHrp)).toThrow(/Orchard hrp/);
  });

  it("rejects a bech32 (non-m) checksum on an Orchard-prefixed string", () => {
    const good = encodeOrchardAddress("regtest", FIXTURE_RAW);
    // Flip the final checksum character — re-encoding bech32m with
    // the wrong final char must fail decode.
    const mangledFinal =
      good.slice(0, -1) + (good.endsWith("q") ? "p" : "q");
    expect(() => decodeOrchardAddress(mangledFinal)).toThrow();
  });

  it("maps coordinator network labels to SDK labels", () => {
    expect(networkFromCoordinator("main")).toBe("mainnet");
    expect(networkFromCoordinator("mainnet")).toBe("mainnet");
    expect(networkFromCoordinator("test")).toBe("testnet");
    expect(networkFromCoordinator("testnet")).toBe("testnet");
    expect(networkFromCoordinator("regtest")).toBe("regtest");
    expect(() => networkFromCoordinator("unknown")).toThrow();
  });
});
