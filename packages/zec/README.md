# @causeway-sh/zec

[![npm](https://img.shields.io/npm/v/@causeway-sh/zec/alpha)](https://www.npmjs.com/package/@causeway-sh/zec)
[![License](https://img.shields.io/npm/l/@causeway-sh/zec)](#license)
[![status](https://img.shields.io/badge/status-alpha-orange.svg)](#status)
[![Causeway](https://img.shields.io/badge/causeway-protocol-purple)](https://causeway.sh)

Zcash transparent off-chain helpers for
[Causeway](https://causeway.sh). t-address derivation, ZIP-244 v5
sighash, scriptSig assembly, and a small `lightwalletd` gRPC-Web
client. Hand-rolled in TypeScript — no WASM bridge required.

For shielded Sapling spends see
[`@causeway-sh/sapling`](https://www.npmjs.com/package/@causeway-sh/sapling).

## Install

```bash
pnpm add @causeway-sh/core@alpha @causeway-sh/zec@alpha
```

## Quickstart

```ts
import {
  deriveVaultAddress,
  buildUnsignedTx,
  assembleSignedTx,
  lowSNormalizeDer,
  LightwalletdClient,
} from "@causeway-sh/zec";

const v = deriveVaultAddress({
  vaultThresholdPubkey, // 33 bytes — from the on-chain Vault account
  tenant,               // 32 bytes — the tenant program's id
  derivationPath,       // canonical Causeway path bytes
  network: "mainnet",
});
console.log(v.tAddress); // "t1…"

const { unsignedTxBytes, sighash } = buildUnsignedTx({ /* ZecSendPlan */ });

// run threshold ECDSA signing round on `sighash`,
// receive a DER signature, low-S normalize, then splice:
const der = lowSNormalizeDer(rawDer);
const signedTx = assembleSignedTx({
  unsignedTxBytes,
  derSignature: der,
  compressedPubkey: v.tweakedPubkey,
});

const lwd = new LightwalletdClient({ baseUrl: "https://zec.rocks:443" });
const txid = await lwd.sendTransaction(signedTx);
```

## API

- `deriveVaultAddress({ vaultThresholdPubkey, tenant, derivationPath, network })`
  — Causeway tweak → HASH160 → Base58Check.
  `network: "mainnet" | "testnet" | "regtest"`. Returns
  `{ tAddress, pkh, tweakedPubkey }`.
- `buildUnsignedTx(plan: ZecSendPlan)` — unsigned v5 transparent tx
  bytes plus the 32-byte ZIP-244 sighash.
- `assembleSignedTx({ unsignedTxBytes, derSignature, compressedPubkey })`
  — splice `<DER+SIGHASH_ALL> <push 33 pubkey>` scriptSig into the
  empty input-0 slot.
- `lowSNormalizeDer(der)` — normalize a DER-encoded ECDSA signature
  to BIP-146 low-S form.
- `LightwalletdClient` — minimal gRPC-Web client for `GetLightdInfo`,
  `GetAddressUtxos`, and `SendTransaction`.

## Scope

M1 shape: single-input, single-output transparent spends. No
multi-UTXO selection, no fee estimation.

## Status

Alpha. Zcash mainnet transparent broadcasts have completed end-to-end
through this SDK. The on-chain program is unverified bytecode and
the protocol is not audited. Do not move funds you can't afford to
lose.

## License

[Apache-2.0](./LICENSE)

## Links

- Repository — <https://github.com/causeway-protocol/sdk-ts>
- Protocol — <https://causeway.sh>
