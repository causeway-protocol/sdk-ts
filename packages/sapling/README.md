# @causeway-sh/sapling

[![npm](https://img.shields.io/npm/v/@causeway-sh/sapling/alpha)](https://www.npmjs.com/package/@causeway-sh/sapling)
[![License](https://img.shields.io/npm/l/@causeway-sh/sapling)](#license)
[![status](https://img.shields.io/badge/status-alpha-orange.svg)](#status)
[![Causeway](https://img.shields.io/badge/causeway-protocol-purple)](https://causeway.sh)

Zcash **Sapling shielded** helpers for
[Causeway](https://causeway.sh). Bech32 z-address parse/encode plus
high-level wrappers around the coordinator's
`BuildAndSignSaplingSpend` and `BroadcastSaplingTx` RPCs. The whole
shielded pipeline runs through the threshold operator quorum — your
dApp never touches a spend-auth key or a Groth16 prover.

## Install

```bash
pnpm add @causeway-sh/core@alpha @causeway-sh/sapling@alpha
```

## Quickstart

```ts
import { GrpcWebCoordinatorClient } from "@causeway-sh/core";
import { sendToZaddr } from "@causeway-sh/sapling";

const coordinator = new GrpcWebCoordinatorClient({
  baseUrl: "https://coordinator.causeway.sh",
});

const result = await sendToZaddr({
  coordinator,
  to: "zs1q3qpr6wt3rzymfrg3pyzfmjny2synhk2ut9as6dyxqpvcdlq94jscze8pww28rnqyplzwz7hpjx",
  amountZat: 50_000n,
  feeZat: 15_000n,
});

console.log("broadcast txid:", result.broadcastTxid);
console.log("sighash:        ", result.sighashHex);
```

That's the entire shielded spend: coordinator builds the PCZT, runs
the FROST-RedJubjub round across 5 of 7 operators, returns a
broadcast-ready v5 transaction, and we send it to mainnet.

## API

- **bech32 z-address helpers** — `decodeSaplingAddress(s)` and
  `encodeSaplingAddress(network, raw43)`. Handles `zs1…` (mainnet),
  `ztestsapling1…` (testnet), and `zregtestsapling1…` (regtest).
  Strict bech32 (not bech32m) so mangled unified-address strings
  fail closed.
- **`sendToZaddr({...})`** — end-to-end convenience: decode bech32,
  call the coordinator, broadcast via the coordinator's `lightwalletd`,
  return `{ broadcastTxid, sighashHex, rawTxHex }`.
- **`fetchSaplingVaultAddress(coordinator)`** — ask the coordinator
  for the active vault's bech32 z-address + raw 43 bytes.
- **`zcashdRpcCall(...)`** — minimal JSON-RPC client for callers that
  want to broadcast through their own `zcashd` instead of the
  coordinator. `fetch`-based, works in Node 20+ and browsers (with
  CORS configured).

## Why the SDK doesn't run Groth16

Sapling spend-auth signing requires the vault's `nsk` for the SNARK
witness. In Causeway's threshold model that material lives only in
the coordinator process and is never exposed to dApps or tenant
programs. The SDK therefore never runs Groth16 — it asks the
coordinator for a signed `raw_tx` and broadcasts it.

## Status

Alpha. Real Sapling shielded mainnet broadcasts have completed
end-to-end through this SDK. The on-chain program is unverified
bytecode and the protocol is not audited. Do not move funds you
can't afford to lose.

## License

[Apache-2.0](./LICENSE)

## Links

- Repository — <https://github.com/causeway-protocol/sdk-ts>
- Protocol — <https://causeway.sh>
