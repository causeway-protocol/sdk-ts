import { describe, it, expect } from "vitest";
import { PublicKey } from "@solana/web3.js";
import {
  AssetId,
  findProtocolConfigPda,
  findSigningRequestPda,
  findTenantAuthorityPda,
  findVaultPda,
} from "../src/index.js";

// Placeholder program ids — 32 bytes of 0x01 / 0x02 so the golden
// vectors below are reproducible without depending on any deployed
// program id. Replace with your deployment's actual program ids in
// production code.
const CAUSEWAY = new PublicKey(Buffer.alloc(32, 1));
const TENANT = new PublicKey(Buffer.alloc(32, 2));

describe("pda derivations", () => {
  it("protocol_config matches sdk-rs golden", () => {
    const [pda, bump] = findProtocolConfigPda(CAUSEWAY);
    expect(pda.toBase58()).toBe("6oUirD6QmiGSBWuHuPD7oGBdPvD95cT8YL4ZyeQAo8iX");
    expect(bump).toBe(255);
  });

  it("vault(Btc, epoch=1) matches sdk-rs golden", () => {
    const [pda, bump] = findVaultPda(CAUSEWAY, AssetId.Btc, 1);
    expect(pda.toBase58()).toBe("J1osU48x7DRJNQbfBLKozm3hf8C5gReQm8px6AearjVf");
    expect(bump).toBe(252);
  });

  it("vault(Eth, epoch=1) matches sdk-rs golden", () => {
    const [pda] = findVaultPda(CAUSEWAY, AssetId.Eth, 1);
    expect(pda.toBase58()).toBe("FJhwteGjRmNKJJDDt28JUgokjxPYzvFeXyNwLsisDkG5");
  });

  it("tenant_authority(Eth, path_hash=AA*32) matches sdk-rs golden", () => {
    const pathHash = new Uint8Array(32).fill(0xaa);
    const [pda, bump] = findTenantAuthorityPda(TENANT, AssetId.Eth, pathHash);
    expect(pda.toBase58()).toBe("EdAQVvyVhQyaJwWd9p55UA2ap8wKHDumUk71coznX5Tp");
    expect(bump).toBe(255);
  });

  it("signing_request matches sdk-rs golden", () => {
    const vault = new PublicKey("FJhwteGjRmNKJJDDt28JUgokjxPYzvFeXyNwLsisDkG5");
    const tenantAuthority = new PublicKey("EdAQVvyVhQyaJwWd9p55UA2ap8wKHDumUk71coznX5Tp");
    const pathHash = new Uint8Array(32).fill(0xaa);
    const requestId = new Uint8Array(32).fill(0xbb);
    const [pda] = findSigningRequestPda(CAUSEWAY, vault, tenantAuthority, pathHash, requestId);
    expect(pda.toBase58()).toBe("aFe82ECgAvvuupH9JcZ39GiWpb3vnGsytHJgnB3PoWi");
  });
});
