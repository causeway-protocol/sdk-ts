import { describe, it, expect } from "vitest";
import { buildUnsignedTx } from "../src/index.js";

function bytesToHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

describe("@causeway-sh/evm tx", () => {
  it("eip-1559 sighash matches sdk-rs golden", () => {
    const tx = buildUnsignedTx({
      from: "0x0000000000000000000000000000000000000000",
      to: "0xdddddddddddddddddddddddddddddddddddddddd",
      valueWei: 1_000_000_000_000_000n,
      gasLimit: 21_000n,
      maxFeePerGas: 30_000_000_000n,
      maxPriorityFeePerGas: 1_000_000_000n,
      nonce: 7,
      chainId: 11_155_111,
    });
    expect(bytesToHex(tx.sighash)).toBe(
      "fc27ad72012f6bec3ec667ca3b4b8a1396d771bf864fc0e1ae9da2357ea02603",
    );
  });
});
