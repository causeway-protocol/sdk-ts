import { describe, it, expect } from "vitest";
import { deriveVaultAddress } from "../src/address.js";

const VAULT = new Uint8Array([
  0x02, 0x79, 0xbe, 0x66, 0x7e, 0xf9, 0xdc, 0xbb, 0xac, 0x55, 0xa0, 0x62, 0x95, 0xce, 0x87,
  0x0b, 0x07, 0x02, 0x9b, 0xfc, 0xdb, 0x2d, 0xce, 0x28, 0xd9, 0x59, 0xf2, 0x81, 0x5b, 0x16,
  0xf8, 0x17, 0x98,
]);
const TENANT = new Uint8Array(32).fill(0x42);
const PATH_ALICE = new Uint8Array([0x01, 0x05, 0x61, 0x6c, 0x69, 0x63, 0x65]); // "alice"

describe("@causeway-sh/btc P2TR parity", () => {
  it("alice testnet4 P2TR address matches sdk-rs golden", () => {
    const v = deriveVaultAddress({
      vaultThresholdPubkey: VAULT,
      tenant: TENANT,
      derivationPath: PATH_ALICE,
      network: "testnet4",
    });
    expect(v.address).toBe("tb1pappqd524alx9ms2vp3nyvvyjad465rueqf5gzmajfr58nvw6e2dqnpra58");
  });

  it("alice mainnet P2TR address matches sdk-rs golden", () => {
    const v = deriveVaultAddress({
      vaultThresholdPubkey: VAULT,
      tenant: TENANT,
      derivationPath: PATH_ALICE,
      network: "mainnet",
    });
    expect(v.address).toBe("bc1pappqd524alx9ms2vp3nyvvyjad465rueqf5gzmajfr58nvw6e2dqyf4jwg");
  });
});
