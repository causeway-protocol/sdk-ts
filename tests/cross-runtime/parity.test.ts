// Cross-runtime parity: each TS @causeway-sh/* package must produce
// byte-identical wire output to its sdk-rs counterpart for the
// canonical "alice" vector. If any of these drift, addresses or
// sighashes diverge across implementations and tenants lose funds.
//
// Vault = secp256k1 generator point compressed (`02 || G_x`).
// Tenant = `[0x42; 32]`.
// Path = canonical `"alice"` (`01 05 'a' 'l' 'i' 'c' 'e'`).

import { describe, it, expect } from "vitest";
import { deriveVaultAddress as deriveEvm } from "@causeway-sh/evm";
import { deriveVaultAddress as deriveZec } from "@causeway-sh/zec";
import { deriveVaultAddress as deriveBtc } from "@causeway-sh/btc";

const VAULT = new Uint8Array([
  0x02, 0x79, 0xbe, 0x66, 0x7e, 0xf9, 0xdc, 0xbb, 0xac, 0x55, 0xa0, 0x62, 0x95, 0xce, 0x87,
  0x0b, 0x07, 0x02, 0x9b, 0xfc, 0xdb, 0x2d, 0xce, 0x28, 0xd9, 0x59, 0xf2, 0x81, 0x5b, 0x16,
  0xf8, 0x17, 0x98,
]);
const TENANT = new Uint8Array(32).fill(0x42);
const PATH_ALICE = new Uint8Array([0x01, 0x05, 0x61, 0x6c, 0x69, 0x63, 0x65]);

function bytesToHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

describe("cross-runtime parity vs sdk-rs golden bytes", () => {
  it("EVM: alice eth address + tweaked pubkey", () => {
    const v = deriveEvm({
      vaultThresholdPubkey: VAULT,
      tenant: TENANT,
      derivationPath: PATH_ALICE,
    });
    expect(bytesToHex(v.tweakedPubkey)).toBe(
      "0329c2bd8b311655a21ef44910b990e07f5a389effaf8bb574df9d61ebc554dd3d",
    );
    expect(bytesToHex(v.addressBytes)).toBe("e2bf197f97e89d3a0941e52935442186b30db3f2");
  });

  it("ZEC: alice testnet t-address + pkh + tweaked pubkey", () => {
    const v = deriveZec({
      vaultThresholdPubkey: VAULT,
      tenant: TENANT,
      derivationPath: PATH_ALICE,
      network: "testnet",
    });
    expect(bytesToHex(v.tweakedPubkey)).toBe(
      "02b5f5762e43ac7759bf7e08c27a521fcdb73fd82bc028bc41c5c669807bd4c7a3",
    );
    expect(bytesToHex(v.pkh)).toBe("44eec55348090ab80a136b95982fa0d3906afdb4");
    expect(v.tAddress).toBe("tmFzqKJV1BNyfWc2qGuE6cpT4FqGHaLQSfC");
  });

  it("ZEC: alice mainnet t-address", () => {
    const v = deriveZec({
      vaultThresholdPubkey: VAULT,
      tenant: TENANT,
      derivationPath: PATH_ALICE,
      network: "mainnet",
    });
    expect(v.tAddress).toBe("t1QA5zTzbniUANMqPcAvMm9nJerBU81CjDq");
  });

  it("BTC: alice testnet4 P2TR address", () => {
    const v = deriveBtc({
      vaultThresholdPubkey: VAULT,
      tenant: TENANT,
      derivationPath: PATH_ALICE,
      network: "testnet4",
    });
    expect(v.address).toBe("tb1pappqd524alx9ms2vp3nyvvyjad465rueqf5gzmajfr58nvw6e2dqnpra58");
  });

  it("BTC: alice mainnet P2TR address", () => {
    const v = deriveBtc({
      vaultThresholdPubkey: VAULT,
      tenant: TENANT,
      derivationPath: PATH_ALICE,
      network: "mainnet",
    });
    expect(v.address).toBe("bc1pappqd524alx9ms2vp3nyvvyjad465rueqf5gzmajfr58nvw6e2dqyf4jwg");
  });
});
