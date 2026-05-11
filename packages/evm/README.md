# @causeway-sh/evm

[![npm](https://img.shields.io/npm/v/@causeway-sh/evm/alpha)](https://www.npmjs.com/package/@causeway-sh/evm)
[![License](https://img.shields.io/npm/l/@causeway-sh/evm)](#license)
[![status](https://img.shields.io/badge/status-alpha-orange.svg)](#status)
[![Causeway](https://img.shields.io/badge/causeway-protocol-purple)](https://causeway.sh)

EVM off-chain helpers for [Causeway](https://causeway.sh). Vault
address derivation, EIP-1559 unsigned-tx + sighash construction,
and signed-tx assembly. Works against any EVM-compatible chain
(Ethereum, Base, Arbitrum, Optimism, Sepolia, anvil).

## Install

```bash
pnpm add @causeway-sh/core@alpha @causeway-sh/evm@alpha
```

## Quickstart

```ts
import {
  deriveVaultAddress,
  buildUnsignedTx,
  assembleSignedTx,
} from "@causeway-sh/evm";

const v = deriveVaultAddress({
  vaultThresholdPubkey, // 33 bytes — from the on-chain Vault account
  tenant,               // 32 bytes — the tenant program's id
  derivationPath,       // canonical Causeway path bytes
});
console.log(v.address); // "0xAbCd…" (EIP-55 checksummed)

const unsigned = buildUnsignedTx({
  chainId: 8453n,       // Base mainnet, for example
  nonce: 0n,
  maxPriorityFeePerGas: 1_000_000_000n,
  maxFeePerGas: 50_000_000_000n,
  gasLimit: 21_000n,
  to: "0xRecipient...",
  value: 1_000_000_000_000_000n, // 0.001 ETH (wei)
  data: "0x",
});

// run threshold signing round on `unsigned.sighash`, get (r, s, v)
const signedRaw = assembleSignedTx({ fields: unsigned.fields, r, s, v });
// broadcast `signedRaw` via any Ethereum JSON-RPC.
```

## API

- `deriveVaultAddress({ vaultThresholdPubkey, tenant, derivationPath })`
  — Causeway tweak → `keccak256(uncompressedPubkey)[12..]` → EIP-55
  checksum. Returns `{ address, addressBytes, tweakedPubkey }`.
- `eip55Checksum(addressBytes)` — standalone EIP-55 helper.
- `buildUnsignedTx(args)` — EIP-1559 unsigned RLP + 32-byte sighash.
- `assembleSignedTx({ fields, r, s, v })` — splice (r, s, v) into the
  signed `0x02 ‖ rlp(...)` wire form.

## Status

Alpha. Base mainnet broadcasts have completed end-to-end through this
SDK. Tested on Sepolia and anvil. The on-chain program is unverified
bytecode and the protocol is not audited. Do not move funds you can't
afford to lose.

## License

[Apache-2.0](./LICENSE)

## Links

- Repository — <https://github.com/causeway-protocol/sdk-ts>
- Protocol — <https://causeway.sh>
