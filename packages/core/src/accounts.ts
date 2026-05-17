// Account decoders + RPC fetchers for SigningRequest, Vault,
// ProtocolConfig. Layouts mirror `programs/causeway/src/state/`.
//
// Fetchers wrap `Connection.getAccountInfo(pda)` and dispatch through
// the matching decoder. They're the canonical way for a dApp to read
// vault state without ever touching the bootstrap CLI's on-disk
// `public-key-*.hex` files — `Vault.thresholdPubkey` on chain is the
// authoritative source after `initialize_vault` has run.

import { Connection, PublicKey } from "@solana/web3.js";
import { AssetId as AssetIdEnum } from "./enums.js";
import { findVaultPda, findSigningRequestPda, findProtocolConfigPda } from "./pda.js";
import { BorshReader } from "./borsh.js";
import {
  AssetId,
  DerivationMode,
  PauseReason,
  RequestStatus,
  SighashKind,
  SignatureFormat,
  VaultStatus,
} from "./enums.js";

/// Anchor `#[account]` discriminators are `sha256("account:<Name>")[..8]`.
/// Hardcoded to avoid a sha256 dep in this module — verified in tests.
export const SIGNING_REQUEST_DISCRIMINATOR = new Uint8Array([
  204, 213, 99, 218, 168, 28, 154, 175,
]);
export const VAULT_DISCRIMINATOR = new Uint8Array([
  211, 8, 232, 43, 2, 152, 117, 119,
]);
export const PROTOCOL_CONFIG_DISCRIMINATOR = new Uint8Array([
  207, 91, 250, 28, 152, 179, 215, 209,
]);

/// Final aggregated signature, populated by `complete_signing`.
/// Mirrors on-chain `CompletedSignature` exactly.
export interface CompletedSignature {
  signatureFormat: SignatureFormat;
  /// 80-byte zero-padded blob. The active prefix is `signatureLen`.
  signatureBlob: Uint8Array;
  signatureLen: number;
  attemptIndex: number;
  roundId: Uint8Array;
  /// Per-operator Ed25519 attestations; `null` for non-participating slots.
  operatorAttestations: Array<Uint8Array | null>;
}

export interface SigningRequest {
  bump: number;
  vault: PublicKey;
  tenant: PublicKey;
  requestId: Uint8Array;
  derivationPathHash: Uint8Array;
  derivationPath: Uint8Array;
  sighashToSign: Uint8Array;
  sighashKind: SighashKind;
  deadlineSlot: bigint;
  createdSlot: bigint;
  completedSlot: bigint | null;
  isRotationDrain: boolean;
  destinationAddressHash: Uint8Array | null;
  status: RequestStatus;
  participatingOperators: boolean[];
  /// Populated by `complete_signing`. Null while `status` is `Pending`,
  /// non-null once the request is `Completed`.
  completedSignature: CompletedSignature | null;
  /// Original rent payer; refunded by `expire_request`.
  rentPayer: PublicKey;
}

const DERIVATION_PATH_MAX_LEN = 133;

export function decodeSigningRequest(data: Uint8Array): SigningRequest {
  const r = BorshReader.from(data);
  // Skip 8-byte Anchor discriminator. Caller is expected to have
  // already confirmed match against SIGNING_REQUEST_DISCRIMINATOR.
  r.skipDiscriminator();
  const bump = r.u8();
  const vault = new PublicKey(r.fixedBytes(32));
  const tenant = new PublicKey(r.fixedBytes(32));
  const requestId = r.fixedBytes(32);
  const derivationPathHash = r.fixedBytes(32);
  const derivationPathBlob = r.fixedBytes(DERIVATION_PATH_MAX_LEN);
  const derivationPathLen = r.u8();
  if (derivationPathLen > DERIVATION_PATH_MAX_LEN) {
    throw new Error(`derivation_path_len out of range: ${derivationPathLen}`);
  }
  const derivationPath = derivationPathBlob.slice(0, derivationPathLen);
  const sighashToSign = r.fixedBytes(32);
  const sighashKind = r.u8() as SighashKind;
  const deadlineSlot = r.u64();
  const createdSlot = r.u64();
  const completedSlot = r.optionU64();
  const isRotationDrain = r.bool();
  const destinationAddressHash = r.optionFixedBytes(32);
  const status = r.u8() as RequestStatus;
  const participatingOperators: boolean[] = [];
  for (let i = 0; i < 7; i++) participatingOperators.push(r.bool());
  // Option<CompletedSignature>: a single tag byte, then the body if Some.
  const hasCompletedSig = r.bool();
  let completedSignature: CompletedSignature | null = null;
  if (hasCompletedSig) {
    const signatureFormat = r.u8() as SignatureFormat;
    const signatureBlob = r.fixedBytes(80);
    const signatureLen = r.u8();
    const attemptIndex = r.u8();
    const roundId = r.fixedBytes(32);
    const operatorAttestations: Array<Uint8Array | null> = [];
    for (let i = 0; i < 7; i++) {
      const present = r.bool();
      operatorAttestations.push(present ? r.fixedBytes(64) : null);
    }
    completedSignature = {
      signatureFormat,
      signatureBlob,
      signatureLen,
      attemptIndex,
      roundId,
      operatorAttestations,
    };
  }
  const rentPayer = new PublicKey(r.fixedBytes(32));
  return {
    bump,
    vault,
    tenant,
    requestId,
    derivationPathHash,
    derivationPath,
    sighashToSign,
    sighashKind,
    deadlineSlot,
    createdSlot,
    completedSlot,
    isRotationDrain,
    destinationAddressHash,
    status,
    participatingOperators,
    completedSignature,
    rentPayer,
  };
}

export interface Vault {
  bump: number;
  asset: AssetId;
  epoch: number;
  thresholdPubkey: Uint8Array;
  operatorSet: PublicKey[];
  kSig: number;
  nOp: number;
  derivationMode: DerivationMode;
  status: VaultStatus;
  pausedReason: PauseReason | null;
  hasRotationDrainCommit: boolean;
  createdAt: bigint;
}

export function decodeVault(data: Uint8Array): Vault {
  const r = BorshReader.from(data);
  r.skipDiscriminator();
  const bump = r.u8();
  const asset = r.u8() as AssetId;
  const epoch = r.u32();
  const thresholdPubkey = r.fixedBytes(33);
  const operatorSet: PublicKey[] = [];
  for (let i = 0; i < 7; i++) operatorSet.push(new PublicKey(r.fixedBytes(32)));
  const kSig = r.u8();
  const nOp = r.u8();
  const derivationMode = r.u8() as DerivationMode;
  const status = r.u8() as VaultStatus;
  const pausedReason = r.bool() ? (r.u8() as PauseReason) : null;
  const hasRotationDrainCommit = r.bool();
  // Skip the rotation-drain commit body if present — internal bookkeeping
  // not exposed at the SDK surface in v0.1.
  if (hasRotationDrainCommit) {
    // Reserved size pinned by `RotationDrainCommit::INIT_SPACE`. To keep
    // this decoder layout-agnostic against future field additions,
    // refuse to decode if the field is set in v0.1; callers in
    // rotation-aware flows should use the on-chain Anchor IDL via
    // `@coral-xyz/anchor` directly.
    throw new Error(
      "Vault has rotation_drain_commit set; not decoded by v0.1 SDK. " +
        "Use anchor IDL via the program client for rotation-aware decoding.",
    );
  }
  const createdAt = r.i64();
  return {
    bump,
    asset,
    epoch,
    thresholdPubkey,
    operatorSet,
    kSig,
    nOp,
    derivationMode,
    status,
    pausedReason,
    hasRotationDrainCommit,
    createdAt,
  };
}

export interface ProtocolConfig {
  bump: number;
  authority: PublicKey;
  m1Frozen: boolean;
  kSig: number;
  nOp: number;
}

export function decodeProtocolConfig(data: Uint8Array): ProtocolConfig {
  const r = BorshReader.from(data);
  r.skipDiscriminator();
  const bump = r.u8();
  const authority = new PublicKey(r.fixedBytes(32));
  const m1Frozen = r.bool();
  const kSig = r.u8();
  const nOp = r.u8();
  return { bump, authority, m1Frozen, kSig, nOp };
}

// ----- RPC fetchers -----------------------------------------------
//
// Each fetcher derives the PDA, calls Connection.getAccountInfo, and
// runs the decoder. Returns `null` when the account doesn't exist —
// the caller decides whether that's an error or a "not initialised
// yet" case.

/// Fetch the Causeway protocol config singleton.
export async function fetchProtocolConfig(
  connection: Connection,
  causewayProgramId: PublicKey,
): Promise<ProtocolConfig | null> {
  const [pda] = findProtocolConfigPda(causewayProgramId);
  const info = await connection.getAccountInfo(pda);
  if (!info) return null;
  return decodeProtocolConfig(info.data);
}

/// Fetch the per-(asset, epoch) Vault account. Returns null if the
/// vault has not been initialised yet.
///
/// `vault.thresholdPubkey` is the 33-byte authoritative group pubkey
/// for every off-chain address derivation. Pass it into
/// `@causeway-sh/btc`'s `deriveVaultAddress`, `@causeway-sh/evm`'s
/// equivalent, etc. The bootstrap CLI's `public-key-*.hex` files are
/// internal artefacts and should NOT be read by dApps.
export async function fetchVault(
  connection: Connection,
  causewayProgramId: PublicKey,
  asset: AssetIdEnum,
  epoch: number,
): Promise<Vault | null> {
  const [pda] = findVaultPda(causewayProgramId, asset, epoch);
  const info = await connection.getAccountInfo(pda);
  if (!info) return null;
  return decodeVault(info.data);
}

/// Fetch a SigningRequest by its PDA. Used after submitting
/// `initiate_*_send` to observe the on-chain lifecycle (Pending →
/// Completed). Returns null until the SigningRequest is created.
export async function fetchSigningRequest(
  connection: Connection,
  pda: PublicKey,
): Promise<SigningRequest | null> {
  const info = await connection.getAccountInfo(pda);
  if (!info) return null;
  return decodeSigningRequest(info.data);
}
