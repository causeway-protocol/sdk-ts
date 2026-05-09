// Bech32 round-trip + payload-length tests for Sapling addresses.

import { describe, it, expect } from "vitest";
import { decodeSaplingAddress, encodeSaplingAddress } from "../src/index.js";

// Real regtest vault zaddr from a `bootstrap-operators-sapling` run.
const REGTEST_VAULT =
  "zregtestsapling1euldd485nn489mlc9qs7g0vt9em845mfzehcp8sverxtwczhyuwhu8jzexhk8z6w4xt2wld40jr";

describe("@causeway-sh/sapling address", () => {
  it("round-trips a regtest z-address byte-identically", () => {
    const parsed = decodeSaplingAddress(REGTEST_VAULT);
    expect(parsed.network).toBe("regtest");
    expect(parsed.raw.length).toBe(43);
    const re = encodeSaplingAddress(parsed.network, parsed.raw);
    expect(re).toBe(REGTEST_VAULT);
  });

  it("rejects a wrong payload length on encode", () => {
    expect(() => encodeSaplingAddress("regtest", new Uint8Array(42))).toThrow(/43 bytes/);
  });

  it("rejects an unknown hrp on decode", () => {
    // Construct a syntactically valid bech32 string with a non-Sapling
    // hrp; we should fail closed rather than parsing as Sapling.
    expect(() =>
      decodeSaplingAddress(
        "ztestxyz1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqgmtkdv",
      ),
    ).toThrow();
  });
});
