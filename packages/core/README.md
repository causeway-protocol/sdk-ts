# @causeway-sh/core

[![npm](https://img.shields.io/npm/v/@causeway-sh/core/alpha)](https://www.npmjs.com/package/@causeway-sh/core)
[![License](https://img.shields.io/npm/l/@causeway-sh/core)](#license)
[![status](https://img.shields.io/badge/status-alpha-orange.svg)](#status)
[![Causeway](https://img.shields.io/badge/causeway-protocol-purple)](https://causeway.sh)

Core TypeScript SDK for [Causeway](https://causeway.sh). PDA
derivations, instruction builders, account decoders, and a gRPC-Web
coordinator client. Required by every other `@causeway-sh/*` package.

## Install

```bash
pnpm add @causeway-sh/core@alpha
# or: npm i @causeway-sh/core@alpha
# or: yarn add @causeway-sh/core@alpha
```

## Quickstart

```ts
import {
  AssetId, SighashKind,
  findVaultPda,
  GrpcWebCoordinatorClient,
  buildCompleteSigningWithPrecompile,
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

// Pair the precompile-verify ix with complete_signing on Solana.
const ixes = buildCompleteSigningWithPrecompile({ /* ... */ });
```

## What's in the box

- **Enums** — `AssetId`, `SighashKind`, `SignatureFormat`, `RequestStatus`,
  `VaultStatus`, `DerivationMode`, `PauseReason`. Discriminant bytes
  match the on-chain Causeway program exactly.
- **PDA derivations** — `findProtocolConfigPda`, `findVaultPda`,
  `findSigningRequestPda`, `findTenantAuthorityPda`. Same seeds as
  the on-chain `programs/causeway`, verified against `sdk-rs`
  golden vectors.
- **Account decoders** — `decodeSigningRequest`, `decodeVault`,
  `decodeProtocolConfig`. Hand-rolled Borsh, no `@coral-xyz/anchor`
  runtime dep.
- **Causeway program ix builders** — `buildInitializeProtocolConfigIx`,
  `buildInitializeVaultIx`, `buildCompleteSigningIx`,
  `buildExpireRequestIx`. Anchor 8-byte discriminators exported
  from `discriminators.ts`.
- **Solana precompile builders** — `buildSecp256k1VerifyIx` (ECDSA
  path), `buildEd25519VerifyIx` (Schnorr / RedDSA path). Byte-for-byte
  identical to the Rust CLI.
- **`buildCompleteSigningWithPrecompile`** — pairs the precompile-verify
  ix with `complete_signing` and wires the `txIndex` correctly so you
  can't accidentally drop the precompile.
- **Coordinator gRPC-Web client** — `GrpcWebCoordinatorClient` (prod),
  `MockCoordinatorClient` (tests). Connect-over-fetch — no extra
  browser shims.
- **Typed errors** — `SDKError` with discriminated `kind`.

## Status

Alpha. Real mainnet broadcasts (Bitcoin, Base, Zcash transparent +
Sapling shielded) have run through this SDK end-to-end. The
on-chain program is unverified bytecode and the protocol is not
audited. Do not move funds you can't afford to lose.

## License

[Apache-2.0](./LICENSE)

## Links

- Repository — <https://github.com/causeway-protocol/sdk-ts>
- Protocol — <https://causeway.sh>
