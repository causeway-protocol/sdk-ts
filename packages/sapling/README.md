# @causeway-sh/sapling

Sapling shielded helpers for the Causeway TypeScript SDK.

## What's here

- **bech32 z-address helpers** — `decodeSaplingAddress(s)` and
  `encodeSaplingAddress(network, raw43)`. Handles `zs1…` (mainnet),
  `ztestsapling1…` (testnet), and `zregtestsapling1…` (regtest).
- **`sendToZaddr({...})` end-to-end** — calls the coordinator's
  `BuildAndSignSaplingSpend` RPC (via `@causeway-sh/core`'s gRPC-Web
  client), then broadcasts the returned `raw_tx` via zcashd's
  `sendrawtransaction`. Returns the txid + the ZIP-244 sighash + the
  raw bytes so callers can log or re-broadcast.
- **`zcashdRpcCall(...)`** — minimal JSON-RPC client; `fetch`-based,
  works in Node 20+ and modern browsers (with CORS configured on
  zcashd). HTTP Basic auth via explicit `(user, password)` because
  `fetch` rejects URL-embedded credentials.

## Why no Groth16 here

Sapling spend-auth signing requires the vault's `nsk` for the SNARK
witness. In Causeway's threshold model that material lives only in
the coordinator process and is never exposed to dApps or tenant
programs. The SDK therefore never runs Groth16 — it asks the
coordinator for a signed `raw_tx` and broadcasts it.

## Quickstart

```ts
import { GrpcWebCoordinatorClient } from "@causeway-sh/core";
import { sendToZaddr } from "@causeway-sh/sapling";

const coordinator = new GrpcWebCoordinatorClient({
  baseUrl: "http://localhost:50090",
});
const result = await sendToZaddr({
  coordinator,
  zcashdRpc: {
    url: "http://localhost:18232",
    user: "causeway",
    password: "causeway_dev",
  },
  to: "zregtestsapling1euldd485nn489mlc9qs7g0vt9em845mfzehcp8sverxtwczhyuwhu8jzexhk8z6w4xt2wld40jr",
  amountZat: 500_000_000n,
  feeZat: 15_000n,
});
console.log("broadcasted", result.broadcastTxid);
```

## License

Apache-2.0.
