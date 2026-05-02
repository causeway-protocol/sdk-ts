# @causeway-sh/btc

Bitcoin off-chain helpers for Causeway. P2TR-only (M1.0 shape).

## Public surface

- `deriveVaultAddress({ vaultThresholdPubkey, tenant, derivationPath, network })`
  — Causeway tweak → BIP-341 TapTweak → bech32m. Returns
  `{ address, outputKey, internalKey }`. `network: "mainnet" | "testnet4"`.
- `buildUnsignedTx(plan)` — single-input single-output unsigned tx
  + 32-byte BIP-341 key-spend sighash.
- `assembleSignedTx({ tx, schnorrSignature })` — splice the 64-byte
  Schnorr signature into the input-0 witness, return raw bytes for
  `sendrawtransaction`.
- `BitcoindRpcClient` — minimal `sendrawtransaction` / `gettxout` /
  `getblockcount` JSON-RPC client.

## Status

Alpha. testnet4 only.
