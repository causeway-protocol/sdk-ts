# @causeway-sh/core

Core Causeway TypeScript SDK. Always required by every consumer.

## Public surface

- **Enums** — `AssetId`, `SighashKind`, `SignatureFormat`, `RequestStatus`,
  `VaultStatus`, `DerivationMode`, `PauseReason`. Discriminant bytes
  match the on-chain Causeway program exactly.
- **PDA derivations** — `findProtocolConfigPda`, `findVaultPda`,
  `findSigningRequestPda`, `findTenantAuthorityPda`. Same seeds as
  `programs/causeway`, verified vs sdk-rs reference vectors.
- **Account decoders** — `decodeSigningRequest`, `decodeVault`,
  `decodeProtocolConfig`. Hand-rolled Borsh reader to avoid pulling
  `@coral-xyz/anchor` at runtime.
- **Causeway program ix builders** — `buildInitializeProtocolConfigIx`,
  `buildInitializeVaultIx`, `buildCompleteSigningIx`,
  `buildExpireRequestIx`. Anchor 8-byte discriminators (constants in
  `discriminators.ts`).
- **Solana precompile builders** — `buildSecp256k1VerifyIx` (ECDSA path),
  `buildEd25519VerifyIx` (Schnorr/RedDSA path). Byte-for-byte
  identical to `cli/src/solana_tx.rs`.
- **`buildCompleteSigningWithPrecompile`** — convenience helper
  that returns precompile + complete_signing ixes pre-wired with the
  right `txIndex`. Avoids "I forgot the precompile" bugs (spike C).
- **Coordinator gRPC-Web client** — `GrpcWebCoordinatorClient` for
  production, `MockCoordinatorClient` for tests. Speaks Connect over
  fetch — no extra browser shims.
- **Typed errors** — `SDKError` with discriminated `kind`. Never
  raw strings.

## Quickstart

```ts
import {
  AssetId, SighashKind,
  findVaultPda, findSigningRequestPda,
  GrpcWebCoordinatorClient,
  buildCompleteSigningWithPrecompile,
} from "@causeway-sh/core";
import { PublicKey } from "@solana/web3.js";

const programId = new PublicKey("<your-causeway-program-id>");
const [vaultPda] = findVaultPda(programId, AssetId.Eth, 1);

const coord = new GrpcWebCoordinatorClient({ baseUrl: "https://coordinator.causeway.sh" });
const round = await coord.runEcdsaSigningRound({
  requestId: new Uint8Array(32), // your random request id
  asset: AssetId.Eth,
  payloadHash: new Uint8Array(32), // your sighash
  sighashKind: SighashKind.EthEip1559,
});

// Then `buildCompleteSigningWithPrecompile(...)` to pair the
// precompile-verify ix with `complete_signing`.
```

## Status

Alpha. Not for real funds.
