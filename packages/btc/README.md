# @causeway-sh/btc

[![npm](https://img.shields.io/npm/v/@causeway-sh/btc/alpha)](https://www.npmjs.com/package/@causeway-sh/btc)
[![License](https://img.shields.io/npm/l/@causeway-sh/btc)](#license)
[![status](https://img.shields.io/badge/status-alpha-orange.svg)](#status)
[![Causeway](https://img.shields.io/badge/causeway-protocol-purple)](https://causeway.sh)

Bitcoin off-chain helpers for [Causeway](https://causeway.sh). P2TR
(Taproot key-spend) vault addresses, BIP-341 sighash construction,
witness assembly, and a small `bitcoind` JSON-RPC client.

## Install

```bash
pnpm add @causeway-sh/core@alpha @causeway-sh/btc@alpha
```

## Quickstart

```ts
import {
  deriveVaultAddress,
  buildUnsignedTx,
  assembleSignedTx,
  BitcoindRpcClient,
} from "@causeway-sh/btc";

const v = deriveVaultAddress({
  vaultThresholdPubkey, // 33 bytes — from the on-chain Vault account
  tenant,               // 32 bytes — the tenant program's id
  derivationPath,       // canonical Causeway path bytes
  network: "mainnet",
});
console.log(v.address); // "bc1p…"

const { unsignedTx, sighash } = buildUnsignedTx({ /* ... */ });

// run threshold Schnorr signing round on `sighash`,
// receive a 64-byte signature, then:
const signedRawTx = assembleSignedTx({ tx: unsignedTx, schnorrSignature });

const rpc = new BitcoindRpcClient({ url: "...", auth: "..." });
const txid = await rpc.sendRawTransaction(signedRawTx);
```

## API

- `deriveVaultAddress({ vaultThresholdPubkey, tenant, derivationPath, network })`
  — Causeway tweak → BIP-341 TapTweak → bech32m. Returns
  `{ address, outputKey, internalKey }`. `network: "mainnet" | "testnet4"`.
- `buildUnsignedTx(plan)` — single-input single-output unsigned tx
  plus the 32-byte BIP-341 key-spend sighash.
- `assembleSignedTx({ tx, schnorrSignature })` — splice the 64-byte
  Schnorr signature into the input-0 witness; returns raw bytes
  ready for `sendrawtransaction`.
- `BitcoindRpcClient` — minimal `sendrawtransaction` / `gettxout` /
  `getblockcount` JSON-RPC client.

## Scope

M1 shape: single-input, single-output, P2TR key-spend. No multi-input
UTXO selection, no fee estimation. Use a fee oracle of your choice
and pass the totals into `buildUnsignedTx`.

## Status

Alpha. Bitcoin mainnet broadcasts have completed end-to-end through
this SDK. The on-chain program is unverified bytecode and the
protocol is not audited. Do not move funds you can't afford to lose.

## License

[Apache-2.0](./LICENSE)

## Links

- Repository — <https://github.com/causeway-protocol/sdk-ts>
- Protocol — <https://causeway.sh>
