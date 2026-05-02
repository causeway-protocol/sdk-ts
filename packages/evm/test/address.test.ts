import { describe, it, expect } from "vitest";
import { deriveVaultAddress, eip55Checksum } from "../src/index.js";

const VAULT = new Uint8Array([
  0x02, 0x79, 0xbe, 0x66, 0x7e, 0xf9, 0xdc, 0xbb, 0xac, 0x55, 0xa0, 0x62, 0x95, 0xce, 0x87,
  0x0b, 0x07, 0x02, 0x9b, 0xfc, 0xdb, 0x2d, 0xce, 0x28, 0xd9, 0x59, 0xf2, 0x81, 0x5b, 0x16,
  0xf8, 0x17, 0x98,
]);
const TENANT = new Uint8Array(32).fill(0x42);
const PATH_ALICE = new Uint8Array([0x01, 0x05, 0x61, 0x6c, 0x69, 0x63, 0x65]); // "alice"

function bytesToHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

describe("@causeway-sh/evm address derivation", () => {
  it("alice eth tweaked pubkey matches sdk-rs golden", () => {
    const v = deriveVaultAddress({
      vaultThresholdPubkey: VAULT,
      tenant: TENANT,
      derivationPath: PATH_ALICE,
    });
    expect(bytesToHex(v.tweakedPubkey)).toBe(
      "0329c2bd8b311655a21ef44910b990e07f5a389effaf8bb574df9d61ebc554dd3d",
    );
    expect(bytesToHex(v.addressBytes)).toBe("e2bf197f97e89d3a0941e52935442186b30db3f2");
  });

  it("eip-55 checksum matches the EIP-55 spec test vector", () => {
    const bytes = new Uint8Array(20);
    const hex = "5aaeb6053f3e94c9b9a09f33669435e7ef1beaed";
    for (let i = 0; i < 20; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    expect(eip55Checksum(bytes)).toBe("0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed");
  });
});
