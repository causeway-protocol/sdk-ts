import { describe, it, expect } from "vitest";
import { PublicKey } from "@solana/web3.js";
import {
  AssetId,
  findProtocolConfigPda,
  findSigningRequestPda,
  findTenantAuthorityPda,
  findVaultPda,
} from "../src/index.js";

const CAUSEWAY = new PublicKey("F3yjcupHLtAkAVfdpY9NMdxn5efFD9ThiCWxVqrgin3w");
const TENANT = new PublicKey("6dZjhd4Avpcoa8XdUjzm3or9q11vKdJnDS3hKjFjm4Hi");

describe("pda derivations", () => {
  it("protocol_config matches sdk-rs golden", () => {
    const [pda, bump] = findProtocolConfigPda(CAUSEWAY);
    expect(pda.toBase58()).toBe("5XpgGg5XrwGPC7BKmxXJMkLwiQjVMKzEbVGr19B1PfL8");
    expect(bump).toBe(255);
  });

  it("vault(Btc, epoch=1) matches sdk-rs golden", () => {
    const [pda, bump] = findVaultPda(CAUSEWAY, AssetId.Btc, 1);
    expect(pda.toBase58()).toBe("J63AeUhKpVdFScSUL1sCbdjQYibxQo4b5cNTGcn8Dhrn");
    expect(bump).toBe(255);
  });

  it("vault(Eth, epoch=1) matches sdk-rs golden", () => {
    const [pda] = findVaultPda(CAUSEWAY, AssetId.Eth, 1);
    expect(pda.toBase58()).toBe("5nYYnD8dWf7D53VKgkXKfennYMbWHs4fL1cKihSRvTrN");
  });

  it("tenant_authority(Eth, path_hash=AA*32) matches sdk-rs golden", () => {
    const pathHash = new Uint8Array(32).fill(0xaa);
    const [pda, bump] = findTenantAuthorityPda(TENANT, AssetId.Eth, pathHash);
    expect(pda.toBase58()).toBe("7HGseikXVe13H6Ge5qiUXXEP51AKJFC37A9SmVewcznw");
    expect(bump).toBe(253);
  });

  it("signing_request matches sdk-rs golden", () => {
    const vault = new PublicKey("5nYYnD8dWf7D53VKgkXKfennYMbWHs4fL1cKihSRvTrN");
    const tenantAuthority = new PublicKey("7HGseikXVe13H6Ge5qiUXXEP51AKJFC37A9SmVewcznw");
    const pathHash = new Uint8Array(32).fill(0xaa);
    const requestId = new Uint8Array(32).fill(0xbb);
    const [pda] = findSigningRequestPda(CAUSEWAY, vault, tenantAuthority, pathHash, requestId);
    expect(pda.toBase58()).toBe("EBXXEJ9cgKUD1z2EHGRqoE5dR9mw4JYZt88ThwgAc2xC");
  });
});
