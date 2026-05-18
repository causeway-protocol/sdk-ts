# @causeway-sh/orchard

Causeway TypeScript SDK — Orchard shielded helpers.

Mirror of [`@causeway-sh/sapling`](../sapling) for the Orchard pool.
Provides:

- **bech32m Orchard address codec** (`uorchardmain1…` / `uorchardtest1…` /
  `uorchardreg1…`). NOT canonical ZIP-316 Unified Addresses — Causeway
  uses an Orchard-only HRP for compactness.
- **Vault address fetcher** — `fetchOrchardVaultAddress(coordinator)`
  returns the configured vault's deposit address.
- **Per-user address + balance** — `fetchUserOrchardAddress` /
  `fetchUserOrchardBalance` for a (tenant, user_pubkey) tuple.
- **Two-phase user spend** — `prepareUserOrchard` → caller-driven
  `initiate_orchard_send` Solana ix → `runUserOrchard` →
  `broadcastOrchard`. PCZT building, Halo 2 proving, and FROST-RedPallas
  signing all happen inside the coordinator daemon — this SDK is purely
  a coordinator-RPC wrapper.

## Install

```sh
pnpm add @causeway-sh/core @causeway-sh/orchard
```

## Quick start

```ts
import { GrpcWebCoordinatorClient } from "@causeway-sh/core";
import {
  fetchOrchardVaultAddress,
  prepareUserOrchard,
  runUserOrchard,
  broadcastRunResult,
} from "@causeway-sh/orchard";

const coordinator = new GrpcWebCoordinatorClient({
  baseUrl: "https://coordinator.causeway.sh",
});

// 1. Display the vault's deposit address.
const vault = await fetchOrchardVaultAddress(coordinator);
console.log("deposit to:", vault.bech32m);

// 2. Prepare a user spend. Coordinator runs Halo 2 (~12s).
const prep = await prepareUserOrchard({
  coordinator,
  vault: vaultPda,                   // 32 bytes
  recipientPaymentAddressRaw,        // 43 bytes (decodeOrchardAddress)
  amountZat: 100_000n,
  feeZat: 10_000n,
  derivationPathHash,                // 32 bytes
  tenantProgramId,                   // 32 bytes
  userPubkey,                        // 32 bytes
});

// 3. Caller commits prep.sighashToSign on-chain via
//    `tenant_demo::initiate_orchard_send` (see @causeway-sh/tenant
//    `buildInitiateOrchardSend`). Coordinator's RunOrchardSigningRound
//    will reference the resulting SigningRequest PDA.

// 4. Drive the FROST-RedPallas round.
const run = await runUserOrchard({
  coordinator,
  sessionId: prep.sessionId,
  signingRequestPda,
  vault: vaultPda,
  derivationPathHash,
});

// 5. Broadcast.
const broadcast = await broadcastRunResult(coordinator, run);
console.log("orchard tx:", Buffer.from(broadcast.txid).toString("hex"));
```

## License

Apache-2.0
