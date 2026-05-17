// Instruction builders for the **canonical initiate-send ABI**.
//
// Causeway's reference tenant program (and any tenant that mirrors its
// shape) exposes five entrypoints — `initiate_btc_send`,
// `initiate_eth_send`, `initiate_zec_send`, `initiate_sapling_send`,
// `initiate_orchard_send`. They all share the same argument tuple and
// account layout:
//
//   args = (request_id [u8;32], derivation_path_hash [u8;32],
//           derivation_path Vec<Vec<u8>>, sighash [u8;32],
//           deadline_slot u64)
//
//   accounts = [
//     tenant_request (mut, init),  // tenant-owned per-request PDA
//     signing_request (mut),       // Causeway's SigningRequest PDA
//     vault (ro),                  // Causeway vault PDA
//     tenant_program (ro),
//     tenant_authority_pda (ro),   // CPI signer
//     user (signer, mut),          // pays rent for both PDAs
//     causeway_program (ro),
//     system_program (ro),
//   ]
//
// Only the Anchor discriminator and the target AssetId differ between
// the five entrypoints. Tenants that follow this ABI work with these
// builders out of the box; tenants with a different ABI ship their
// own builders.
//
// The reference tenant additionally enforces
// `derivation_path = [user.publicKey]` (so a user can only spend from
// their own per-user vault address); these builders pre-fill that path
// for you. Tenants that allow richer paths should re-implement.

import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { sha256 } from "@noble/hashes/sha256";
import {
  AssetId,
  findVaultPda,
  findSigningRequestPda,
  findTenantAuthorityPdaForSegments,
} from "@causeway-sh/core";
import { REFERENCE_TENANT_PROGRAM_ID } from "./constants.js";
import { findReferenceTenantRequestPda } from "./pda.js";

const TEXT = new TextEncoder();

function anchorDiscriminator(fnName: string): Uint8Array {
  return sha256(TEXT.encode(`global:${fnName}`)).slice(0, 8);
}

function u32le(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n >>> 0, true);
  return b;
}

function u64le(n: bigint): Uint8Array {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, n, true);
  return b;
}

function encodeVecVecU8(segments: Uint8Array[]): Uint8Array {
  const parts: Uint8Array[] = [u32le(segments.length)];
  let total = 4;
  for (const seg of segments) {
    parts.push(u32le(seg.length));
    parts.push(seg);
    total += 4 + seg.length;
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

function fixed32(b: Uint8Array, name: string): Uint8Array {
  if (b.length !== 32) {
    throw new Error(`${name} must be 32 bytes, got ${b.length}`);
  }
  return b;
}

function concat(...xs: Uint8Array[]): Uint8Array {
  const total = xs.reduce((n, x) => n + x.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const x of xs) {
    out.set(x, off);
    off += x.length;
  }
  return out;
}

export interface InitiateSendArgs {
  /// User signing + paying. The canonical ABI binds the derivation
  /// path to this pubkey; only this user can later spend.
  user: PublicKey;
  /// 32-byte caller-supplied request id. Becomes part of both PDAs;
  /// must be unique per `(user, tenant_program)`.
  requestId: Uint8Array;
  /// 32-byte sighash the threshold signature will be produced over.
  sighashToSign: Uint8Array;
  /// Slot at which the request expires (rent can then be reclaimed).
  /// Typical: current slot + ~600 (~4 min on devnet).
  deadlineSlot: bigint;
  /// Deployed tenant program id. Defaults to the reference tenant
  /// (`REFERENCE_TENANT_PROGRAM_ID`). Pass your own to target a
  /// non-reference deployment that follows the same ABI.
  tenantProgramId?: PublicKey;
  /// Deployed Causeway program id.
  causewayProgramId: PublicKey;
  /// Which vault epoch this tenant authority binds against.
  vaultEpoch: number;
}

interface AssetMeta {
  asset: AssetId;
  fn:
    | "initiate_btc_send"
    | "initiate_eth_send"
    | "initiate_zec_send"
    | "initiate_sapling_send"
    | "initiate_orchard_send";
}

/// Resolved PDAs + canonical path hash for a single initiate call.
/// Returned alongside the instruction so callers can reuse them when
/// building the matching `complete_signing` later.
export interface InitiateSendResolved {
  ix: TransactionInstruction;
  vaultPda: PublicKey;
  tenantAuthorityPda: PublicKey;
  signingRequestPda: PublicKey;
  tenantRequestPda: PublicKey;
  /// 32-byte SHA-256 of the canonical derivation path.
  pathHash: Uint8Array;
}

function resolve(meta: AssetMeta, args: InitiateSendArgs): InitiateSendResolved {
  const tenantProgramId = args.tenantProgramId ?? REFERENCE_TENANT_PROGRAM_ID;
  const requestId = fixed32(args.requestId, "requestId");

  // Canonical per-user binding: single-segment path = user pubkey.
  const pathSegments: Uint8Array[] = [args.user.toBytes()];
  const [tenantAuthorityPda] = findTenantAuthorityPdaForSegments(
    tenantProgramId,
    meta.asset,
    pathSegments,
  );
  // canonical encoding for the single-segment case: 0x01 || 0x20 || pk
  const pathHash = sha256(
    concat(Uint8Array.of(1), Uint8Array.of(32), args.user.toBytes()),
  );

  const [vaultPda] = findVaultPda(args.causewayProgramId, meta.asset, args.vaultEpoch);
  const [signingRequestPda] = findSigningRequestPda(
    args.causewayProgramId,
    vaultPda,
    tenantAuthorityPda,
    pathHash,
    requestId,
  );
  const [tenantRequestPda] = findReferenceTenantRequestPda(
    args.user,
    requestId,
    tenantProgramId,
  );

  const data = concat(
    anchorDiscriminator(meta.fn),
    requestId,
    pathHash,
    encodeVecVecU8(pathSegments),
    fixed32(args.sighashToSign, "sighashToSign"),
    u64le(args.deadlineSlot),
  );

  const ix = new TransactionInstruction({
    programId: tenantProgramId,
    keys: [
      { pubkey: tenantRequestPda, isSigner: false, isWritable: true },
      { pubkey: signingRequestPda, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: false },
      { pubkey: tenantProgramId, isSigner: false, isWritable: false },
      { pubkey: tenantAuthorityPda, isSigner: false, isWritable: false },
      { pubkey: args.user, isSigner: true, isWritable: true },
      { pubkey: args.causewayProgramId, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });

  return {
    ix,
    vaultPda,
    tenantAuthorityPda,
    signingRequestPda,
    tenantRequestPda,
    pathHash,
  };
}

export function buildInitiateBtcSend(args: InitiateSendArgs): InitiateSendResolved {
  return resolve({ asset: AssetId.Btc, fn: "initiate_btc_send" }, args);
}

export function buildInitiateEthSend(args: InitiateSendArgs): InitiateSendResolved {
  return resolve({ asset: AssetId.Eth, fn: "initiate_eth_send" }, args);
}

export function buildInitiateZecSend(args: InitiateSendArgs): InitiateSendResolved {
  return resolve({ asset: AssetId.ZecT, fn: "initiate_zec_send" }, args);
}

export function buildInitiateSaplingSend(args: InitiateSendArgs): InitiateSendResolved {
  return resolve({ asset: AssetId.Sapling, fn: "initiate_sapling_send" }, args);
}

export function buildInitiateOrchardSend(args: InitiateSendArgs): InitiateSendResolved {
  return resolve({ asset: AssetId.Orchard, fn: "initiate_orchard_send" }, args);
}
