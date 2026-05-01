import { describe, it, expect } from "vitest";
import { buildSecp256k1VerifyIx, buildEd25519VerifyIx } from "../src/precompile.js";

describe("precompile builders byte-shape", () => {
  it("secp256k1 verify ix has exactly 129 bytes for a 32-byte message", () => {
    const ix = buildSecp256k1VerifyIx({
      ethAddress: new Uint8Array(20),
      signature: new Uint8Array(64),
      recoveryId: 0,
      message: new Uint8Array(32),
      txIndex: 0,
    });
    expect(ix.data.length).toBe(129);
  });

  it("secp256k1 offsets layout matches main-repo", () => {
    const addr = new Uint8Array(20).fill(0xAA);
    const sig = new Uint8Array(64).fill(0xBB);
    const msg = new Uint8Array(32).fill(0xCC);
    const recid = 1;
    const txIndex = 3;
    const ix = buildSecp256k1VerifyIx({ ethAddress: addr, signature: sig, recoveryId: recid, message: msg, txIndex });
    const data = new Uint8Array(ix.data);
    const view = new DataView(data.buffer);
    expect(data[0]).toBe(1);
    expect(view.getUint16(1, true)).toBe(32);          // signature_offset
    expect(data[3]).toBe(txIndex);
    expect(view.getUint16(4, true)).toBe(12);          // eth_address_offset
    expect(data[6]).toBe(txIndex);
    expect(view.getUint16(7, true)).toBe(32 + 64 + 1); // message_offset
    expect(view.getUint16(9, true)).toBe(32);          // message_size
    expect(data[11]).toBe(txIndex);
    expect(data.slice(12, 32)).toEqual(addr);
    expect(data.slice(32, 96)).toEqual(sig);
    expect(data[96]).toBe(recid);
    expect(data.slice(97, 129)).toEqual(msg);
  });

  it("ed25519 verify ix uses SAME_INSTRUCTION sentinel for self-reference", () => {
    const pk = new Uint8Array(32).fill(0x11);
    const sig = new Uint8Array(64).fill(0x22);
    const msg = new Uint8Array(32).fill(0x33);
    const ix = buildEd25519VerifyIx({ pubkey: pk, signature: sig, message: msg });
    const data = new Uint8Array(ix.data);
    const view = new DataView(data.buffer);
    expect(data[0]).toBe(1);
    expect(data[1]).toBe(0);
    expect(view.getUint16(4, true)).toBe(0xFFFF);  // signature_instruction_index
    expect(view.getUint16(8, true)).toBe(0xFFFF);  // pubkey_instruction_index
    expect(view.getUint16(14, true)).toBe(0xFFFF); // message_instruction_index
  });
});
