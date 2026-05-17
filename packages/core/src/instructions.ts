// Causeway program instruction builders. Each returns a
// TransactionInstruction the caller can stuff into any Transaction.
//
// Tenant-side `initiate_*_send` instructions are NOT exposed here —
// those are tenant-program-specific. See @causeway-sh/tenant for the
// generic helpers and ship a per-tenant package for your tenant's
// instruction surface.

import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import {
  COMPLETE_SIGNING_DISC,
  EXPIRE_REQUEST_DISC,
  INITIALIZE_PROTOCOL_CONFIG_DISC,
  INITIALIZE_VAULT_DISC,
} from "./discriminators.js";
import type { SignatureFormat, SighashKind, AssetId, DerivationMode } from "./enums.js";

function concat(...xs: Uint8Array[]): Uint8Array {
  const total = xs.reduce((a, x) => a + x.length, 0);
  const out = new Uint8Array(total);
  let i = 0;
  for (const x of xs) { out.set(x, i); i += x.length; }
  return out;
}

function u8(n: number): Uint8Array { return new Uint8Array([n]); }
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
function pubkey32(p: PublicKey): Uint8Array { return new Uint8Array(p.toBytes()); }
function fixedBytes(b: Uint8Array, n: number): Uint8Array {
  if (b.length !== n) throw new Error(`expected ${n} bytes, got ${b.length}`);
  return b;
}

export interface InitializeProtocolConfigArgs {
  programId: PublicKey;
  protocolConfigPda: PublicKey;
  authority: PublicKey;
  payer: PublicKey;
  kSig: number;
  nOp: number;
}

export function buildInitializeProtocolConfigIx(
  args: InitializeProtocolConfigArgs,
): TransactionInstruction {
  const data = concat(INITIALIZE_PROTOCOL_CONFIG_DISC, u8(args.kSig), u8(args.nOp));
  return new TransactionInstruction({
    programId: args.programId,
    keys: [
      { pubkey: args.protocolConfigPda, isSigner: false, isWritable: true },
      { pubkey: args.authority, isSigner: true, isWritable: false },
      { pubkey: args.payer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
}

export interface InitializeVaultArgs {
  programId: PublicKey;
  protocolConfigPda: PublicKey;
  vaultPda: PublicKey;
  authority: PublicKey;
  payer: PublicKey;
  asset: AssetId;
  epoch: number;
  thresholdPubkey: Uint8Array; // 33 bytes
  operatorSet: PublicKey[];    // 7 keys
  kSig: number;
  nOp: number;
  derivationMode: DerivationMode;
}

export function buildInitializeVaultIx(args: InitializeVaultArgs): TransactionInstruction {
  if (args.operatorSet.length !== 7) {
    throw new Error(`operator_set must have 7 entries, got ${args.operatorSet.length}`);
  }
  const operatorBytes = concat(...args.operatorSet.map(pubkey32));
  const data = concat(
    INITIALIZE_VAULT_DISC,
    u8(args.asset),
    u32le(args.epoch),
    fixedBytes(args.thresholdPubkey, 33),
    operatorBytes,
    u8(args.kSig),
    u8(args.nOp),
    u8(args.derivationMode),
  );
  return new TransactionInstruction({
    programId: args.programId,
    keys: [
      { pubkey: args.protocolConfigPda, isSigner: false, isWritable: false },
      { pubkey: args.vaultPda, isSigner: false, isWritable: true },
      { pubkey: args.authority, isSigner: true, isWritable: false },
      { pubkey: args.payer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
}

export interface CompleteSigningArgs {
  programId: PublicKey;
  signingRequestPda: PublicKey;
  vaultPda: PublicKey;
  participatingOperators: boolean[]; // 7
  attemptIndex: number;
  roundId: Uint8Array;       // 32
  signatureFormat: SignatureFormat;
  signatureBlob: Uint8Array;  // up to 80
  signatureLen: number;
  /// Indices into the surrounding tx's ix list pointing at the
  /// precompile verifies (ed25519 / secp256k1) the program will
  /// inspect via Sysvar::Instructions during `complete_signing`.
  attestationIxIndices: number[];
}

// The Sysvar::Instructions account (used by the program to walk
// precompile entries) lives at a fixed pubkey.
const SYSVAR_INSTRUCTIONS_PUBKEY = new PublicKey("Sysvar1nstructions1111111111111111111111111");

export function buildCompleteSigningIx(args: CompleteSigningArgs): TransactionInstruction {
  if (args.participatingOperators.length !== 7) {
    throw new Error(`participating_operators must have 7 entries`);
  }
  if (args.signatureBlob.length !== 80) {
    throw new Error(`signature_blob must be exactly 80 bytes (zero-padded), got ${args.signatureBlob.length}`);
  }
  const flagBytes = new Uint8Array(args.participatingOperators.map((b) => (b ? 1 : 0)));
  const ixIndicesBytes = new Uint8Array(args.attestationIxIndices);
  const ixIndicesLen = u32le(ixIndicesBytes.length);
  const data = concat(
    COMPLETE_SIGNING_DISC,
    flagBytes,
    u8(args.attemptIndex),
    fixedBytes(args.roundId, 32),
    u8(args.signatureFormat),
    fixedBytes(args.signatureBlob, 80),
    u8(args.signatureLen),
    ixIndicesLen,
    ixIndicesBytes,
  );
  return new TransactionInstruction({
    programId: args.programId,
    keys: [
      { pubkey: args.signingRequestPda, isSigner: false, isWritable: true },
      { pubkey: args.vaultPda, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
}

export interface ExpireRequestArgs {
  programId: PublicKey;
  signingRequestPda: PublicKey;
  /// MUST equal `SigningRequest.rent_payer`; the on-chain constraint
  /// rejects any other receiver. Permissionless — anyone can submit this
  /// ix regardless of who pays the fee, since the on-chain accounts
  /// struct does not require `caller` to sign.
  rentRefundTo: PublicKey;
}

export function buildExpireRequestIx(args: ExpireRequestArgs): TransactionInstruction {
  return new TransactionInstruction({
    programId: args.programId,
    keys: [
      { pubkey: args.signingRequestPda, isSigner: false, isWritable: true },
      { pubkey: args.rentRefundTo, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(EXPIRE_REQUEST_DISC),
  });
}
