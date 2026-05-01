# causeway-sh/sdk-ts

TypeScript SDK monorepo for Causeway. Five packages, layered:

| Package | Purpose | Audience |
|---|---|---|
| `@causeway-sh/core` | PDA derivations, Causeway program ix builders, account decoders, precompile builders, coordinator gRPC-Web client. | Always required. |
| `@causeway-sh/tenant` | Generic tenant-program helpers (parameterised by `tenantProgramId`). | Tenant-program authors. |
| `@causeway-sh/evm` | EVM address derivation + EIP-1559 unsigned tx + signed-tx assembly. | dApps integrating EVM-asset spending. |
| `@causeway-sh/zec` | Zcash transparent address derivation + ZIP-244 v5 sighash + scriptSig assembly + lightwalletd gRPC-Web client. | dApps integrating ZEC. |
| `@causeway-sh/btc` | Bitcoin P2TR address derivation + BIP-341 sighash + witness assembly + bitcoind RPC client. | dApps integrating BTC. |

## Status

Alpha. Not for real funds.

## Working with the workspace

```bash
pnpm install
pnpm -r build
pnpm -r test
```

Each package publishes independently to npm under the `@causeway-sh`
scope. Asset packages depend on `core` + `tenant` only — never on
each other. Bundle-size CI prevents accidental cross-asset imports.
