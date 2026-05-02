# @causeway-sh/evm

EVM-asset off-chain helpers for Causeway. Works against any EVM-
compatible chain (Ethereum mainnet, Sepolia, Base, Arbitrum, etc.).

## Public surface

- `deriveVaultAddress({ vaultThresholdPubkey, tenant, derivationPath })`
  — Causeway tweak → keccak256(uncompressed pubkey)[12..] → EIP-55
  checksum. Returns `{ address, addressBytes, tweakedPubkey }`.
- `eip55Checksum(addressBytes)` — standalone EIP-55 helper.
- `buildUnsignedTx(args)` — EIP-1559 unsigned RLP + 32-byte sighash.
- `assembleSignedTx({ fields, r, s, v })` — splice into the signed
  `0x02 || rlp(...)` wire form.

## Quickstart

```ts
import { deriveVaultAddress, buildUnsignedTx, assembleSignedTx } from "@causeway-sh/evm";

const v = deriveVaultAddress({
  vaultThresholdPubkey,  // 33 bytes from the on-chain Vault account
  tenant,                // 32 bytes — the tenant program's id
  derivationPath,        // canonical bytes per the Causeway spec
});
console.log(v.address);  // "0x..."

const unsigned = buildUnsignedTx({ ... });
// run threshold signing round, get r, s, v
const signed = assembleSignedTx({ fields: unsigned.fields, r, s, v });
// broadcast `signed` via any Ethereum JSON-RPC.
```

## Status

Alpha. Tested on Sepolia and anvil.
