# Causeway TypeScript SDK

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![status](https://img.shields.io/badge/status-alpha-orange.svg)](#status)
[![Causeway](https://img.shields.io/badge/causeway-protocol-purple)](https://causeway.sh)

TypeScript SDK for [Causeway](https://causeway.sh). Causeway is a
Solana program plus an off-chain operator quorum: tenant programs
ask it to sign a sighash, 5 of 7 operators run a threshold round,
and the result is a valid signature on Bitcoin, an EVM chain
(ETH / Base), Zcash transparent, or Zcash Sapling shielded.

No per-asset wallet keys exist. The vault address on each chain is
derived from the threshold pubkey + a tenant-defined path.

## Packages

| Package | Purpose | Audience |
|---|---|---|
| [`@causeway-sh/core`](./packages/core) | PDA derivations, Causeway program ix builders, account decoders, precompile builders, coordinator gRPC-Web client. | Always required. |
| [`@causeway-sh/tenant`](./packages/tenant) | Generic tenant-program helpers (parameterised by `tenantProgramId`). | Tenant-program authors. |
| [`@causeway-sh/evm`](./packages/evm) | EVM address derivation + EIP-1559 unsigned tx + signed-tx assembly. | dApps integrating EVM-asset spending. |
| [`@causeway-sh/zec`](./packages/zec) | Zcash transparent address derivation + ZIP-244 v5 sighash + scriptSig assembly + lightwalletd gRPC-Web client. | dApps integrating ZEC-T. |
| [`@causeway-sh/btc`](./packages/btc) | Bitcoin P2TR address derivation + BIP-341 sighash + witness assembly + bitcoind RPC client. | dApps integrating BTC. |
| [`@causeway-sh/sapling`](./packages/sapling) | Zcash Sapling shielded — bech32 payment-address parse/encode + `BuildAndSignSaplingSpend` / `BroadcastSaplingTx` coordinator wrappers. | dApps integrating shielded ZEC. |

Asset packages depend on `core` + `tenant` only, never on each other.
A bundle-size CI gate blocks cross-asset imports so an EVM-only
consumer doesn't pull in the Zcash bundle.

## Install

```bash
pnpm add @causeway-sh/core @causeway-sh/evm     # for EVM dApps
pnpm add @causeway-sh/core @causeway-sh/sapling # for shielded ZEC
```

## Quickstart

Run an ETH threshold-signing round from the browser:

```ts
import {
  AssetId, SighashKind,
  findVaultPda,
  GrpcWebCoordinatorClient,
} from "@causeway-sh/core";
import { PublicKey } from "@solana/web3.js";

const programId = new PublicKey("<your-causeway-program-id>");
const [vaultPda] = findVaultPda(programId, AssetId.Eth, 1);

const coord = new GrpcWebCoordinatorClient({
  baseUrl: "https://coordinator.causeway.sh",
});

const round = await coord.runEcdsaSigningRound({
  requestId: crypto.getRandomValues(new Uint8Array(32)),
  asset: AssetId.Eth,
  payloadHash: yourEip1559Sighash, // Uint8Array(32)
  sighashKind: SighashKind.EthEip1559,
});

// round.signature is r || s || v. Splice into the EIP-1559 tx and
// broadcast through any RPC.
```

See each per-package README for asset-specific snippets.

## Status

Alpha. We've broadcast end-to-end threshold-signed transactions on
Bitcoin, Base, and Zcash mainnet (shielded + transparent) using this
SDK. The protocol is not audited and the on-chain program is
unverified bytecode. Do not move funds you can't afford to lose.

## Workspace

```bash
pnpm install
pnpm -r build
pnpm -r test
```

Each package publishes independently to npm under the `@causeway-sh`
scope.

## License

Apache-2.0. See [LICENSE](./LICENSE).

## Links

- Protocol — <https://causeway.sh>
- Rust SDK — <https://github.com/causeway-protocol/sdk-rs>
