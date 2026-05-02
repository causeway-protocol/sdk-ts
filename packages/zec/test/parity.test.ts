import { describe, it, expect } from "vitest";
import { deriveVaultAddress } from "../src/address.js";
import { buildUnsignedTx, type ZecSendPlan } from "../src/tx.js";

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

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

describe("@causeway-sh/zec address parity", () => {
  it("alice testnet t-address matches sdk-rs golden", () => {
    const v = deriveVaultAddress({
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

  it("alice mainnet t-address matches sdk-rs golden", () => {
    const v = deriveVaultAddress({
      vaultThresholdPubkey: VAULT,
      tenant: TENANT,
      derivationPath: PATH_ALICE,
      network: "mainnet",
    });
    expect(v.tAddress).toBe("t1QA5zTzbniUANMqPcAvMm9nJerBU81CjDq");
  });
});

describe("@causeway-sh/zec ZIP-244 parity", () => {
  it("fixture 1in1out_nu5_basic matches Rust reference (spike-A golden)", () => {
    const plan: ZecSendPlan = {
      prevOutpointTxid: new Uint8Array(32).fill(0xaa),
      prevOutpointIndex: 0,
      inputScriptPubkey: hexToBytes("76a914111111111111111111111111111111111111111188ac"),
      inputValueZat: 100_000n,
      outputScriptPubkey: hexToBytes("76a914222222222222222222222222222222222222222288ac"),
      outputValueZat: 90_000n,
      lockTime: 0,
      expiryHeight: 1_000_000,
      consensusBranchId: 3_268_858_036,
    };
    const tx = buildUnsignedTx(plan);
    expect(bytesToHex(tx.unsignedTxBytes)).toBe(
      "050000800a27a726b4d0d6c20000000040420f0001aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0000000000ffffffff01905f0100000000001976a914222222222222222222222222222222222222222288ac000000",
    );
    expect(bytesToHex(tx.sighash)).toBe(
      "b4ba40334e46f0432cb0c80adeea1160074ddd77e001dec37261199580f08ffa",
    );
  });
});
