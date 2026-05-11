# @causeway-sh/tenant

[![npm](https://img.shields.io/npm/v/@causeway-sh/tenant/alpha)](https://www.npmjs.com/package/@causeway-sh/tenant)
[![License](https://img.shields.io/npm/l/@causeway-sh/tenant)](#license)
[![status](https://img.shields.io/badge/status-alpha-orange.svg)](#status)
[![Causeway](https://img.shields.io/badge/causeway-protocol-purple)](https://causeway.sh)

Generic tenant-program helpers for [Causeway](https://causeway.sh).
Anything that's cross-tenant: authority-PDA derivation, signing-request
status polling, completion waits. Parameterised by `tenantProgramId`
so the same code works against any tenant deployment.

## Install

```bash
pnpm add @causeway-sh/core@alpha @causeway-sh/tenant@alpha
```

## Quickstart

```ts
import {
  findTenantAuthority,
  getSigningRequestStatus,
  waitForCompletion,
} from "@causeway-sh/tenant";
import { PublicKey, Connection } from "@solana/web3.js";

const cfg = {
  causewayProgramId: new PublicKey("<causeway-program-id>"),
  tenantProgramId:   new PublicKey("<your-tenant-program-id>"),
};

const [authority] = findTenantAuthority(cfg, AssetId.Eth, pathHash);

// After your tenant program submits initiate_eth_send + CPIs into
// causeway::request_signing, poll until the round completes:
const result = await waitForCompletion(
  new Connection("https://api.devnet.solana.com"),
  signingRequestPda,
  { timeoutMs: 30_000 },
);
console.log(result.status);          // "Completed" | "Expired" | ...
console.log(result.signatureBlob);   // signed bytes once Completed
```

## API

- `findTenantAuthority(cfg, asset, pathHash)` — derive the tenant
  authority PDA under the configured tenant program.
- `findTenantRequestPda(...)` — re-export of `@causeway-sh/core`'s
  signing-request PDA derivation, for convenience.
- `getSigningRequestStatus(connection, requestPda)` — read the
  on-chain `SigningRequest` and report its lifecycle status.
- `waitForCompletion(connection, requestPda, opts?)` — poll until a
  signing request is completed (or times out).

## Not in scope

Tenant-program *instruction builders* (e.g. `initiate_btc_send`,
`initiate_sapling_send`) are specific to each tenant's Solana program
ABI. Each tenant project ships its own SDK package alongside its
program. This package only carries the parts every tenant needs.

## Status

Alpha. Real mainnet broadcasts have run through this stack. The
on-chain program is unverified bytecode and the protocol is not
audited. Do not move funds you can't afford to lose.

## License

[Apache-2.0](./LICENSE)

## Links

- Repository — <https://github.com/causeway-protocol/sdk-ts>
- Protocol — <https://causeway.sh>
