// On-chain enum mirrors. Discriminant byte values must match the
// Causeway program's `state/types.rs` exactly. Verified against
// `causeway-types` golden bytes via the Day 4 cross-runtime parity test.

export const AssetId = {
  Btc: 0,
  Eth: 1,
  ZecT: 2,
  Sapling: 3,
  Orchard: 4,
} as const;
export type AssetId = (typeof AssetId)[keyof typeof AssetId];

export const VaultStatus = {
  Active: 0,
  Rotating: 1,
  Paused: 2,
} as const;
export type VaultStatus = (typeof VaultStatus)[keyof typeof VaultStatus];

export const DerivationMode = {
  PathAStateless: 0,
  PathBPerPathRegistry: 1,
  PathCPerTenantRegistry: 2,
} as const;
export type DerivationMode = (typeof DerivationMode)[keyof typeof DerivationMode];

export const PauseReason = {
  EmergencyPause: 0,
  GovernanceHalt: 1,
  RotationFinalized: 2,
} as const;
export type PauseReason = (typeof PauseReason)[keyof typeof PauseReason];

export const RequestStatus = {
  Pending: 0,
  Completed: 1,
  Failed: 2,
} as const;
export type RequestStatus = (typeof RequestStatus)[keyof typeof RequestStatus];

export const SighashKind = {
  BtcTaprootKeySpend: 0,
  BtcSegwitV0: 1,
  EthLegacy: 2,
  EthEip1559: 3,
  ZecTransparentZip244: 4,
  SaplingSpendAuth: 5,
  OrchardSpendAuth: 6,
} as const;
export type SighashKind = (typeof SighashKind)[keyof typeof SighashKind];

export const SignatureFormat = {
  Schnorr64: 0,
  EcdsaDer: 1,
  EcdsaRecoverable65: 2,
  RedJubjub64: 3,
  RedPallas64: 4,
} as const;
export type SignatureFormat = (typeof SignatureFormat)[keyof typeof SignatureFormat];
