# @causeway-sh/zec

Zcash transparent off-chain helpers for Causeway.

## Public surface

- `deriveVaultAddress({ vaultThresholdPubkey, tenant, derivationPath, network })`
  — Causeway tweak → HASH160 → Base58Check.
  `network: "testnet" | "regtest" | "mainnet"`. Returns
  `{ tAddress, pkh, tweakedPubkey }`.
- `buildUnsignedTx(plan: ZecSendPlan)` — unsigned v5 transparent tx
  bytes + 32-byte ZIP-244 sighash. Hand-rolled in TS — no WASM bridge.
- `assembleSignedTx({ unsignedTxBytes, derSignature, compressedPubkey })`
  — splice `<DER+SIGHASH_ALL> <push 33 pubkey>` scriptSig into the
  empty input-0 slot.
- `lowSNormalizeDer(der)` — normalize a DER-encoded ECDSA signature
  to BIP-146 low-S form.
- `LightwalletdClient` — minimal gRPC-Web client for `GetLightdInfo`,
  `GetAddressUtxos`, and `SendTransaction`.

## Status

Alpha. Regtest / testnet only. Single-input single-output shape; the
M1.0 demo CLI's pattern.
