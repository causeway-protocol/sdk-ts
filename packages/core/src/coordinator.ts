// Coordinator gRPC-Web client.
//
// Backed by buf-generated bindings (@bufbuild/protoc-gen-es v2,
// `pnpm proto:gen`) and connect-web's gRPC-Web transport. The wire
// format is binary protobuf inside gRPC-Web frames — same wire the
// `tonic_web::enable(...)` server emits, so dApps can hit a live
// coordinator from a browser or node without any proxy.
//
// The high-level `CoordinatorClient` interface below wraps the
// generated client and shapes inputs/outputs into the camelCase /
// `Uint8Array` style consumers prefer; downstream packages
// (`@causeway-sh/{evm,zec,btc,sapling,orchard}`) depend on the interface,
// not the generated types.

import { createClient } from "@connectrpc/connect";
import type { Client, Transport } from "@connectrpc/connect";
import { createGrpcWebTransport } from "@connectrpc/connect-web";

import { CoordinatorControl } from "./gen/causeway/coordinator_control_pb.js";
import type { AssetId, SighashKind, SignatureFormat } from "./enums.js";

// ----- High-level request/response shapes -----------------------

export interface RunSigningRoundRequest {
  /// 32-byte SigningRequest PDA.
  signingRequestPda: Uint8Array;
  /// 32-byte sighash to sign.
  sighashToSign: Uint8Array;
  /// Canonical derivation-path bytes (Anchor's `Vec<Vec<u8>>` flattened).
  derivationPathCanonical: Uint8Array;
  /// 32-byte sha256 hash of the canonical derivation path.
  derivationPathHash: Uint8Array;
  attemptIndex: number;
  /// Subset of operators participating, encoded as a 7-bit bitmask.
  /// Default 0b001_1111 picks operators 0..=4.
  participatingBitmask?: number;
  /// "Btc" | "Eth" | "ZecT" | "Sapling" | "Orchard"
  asset: string;
  sighashKind: SighashKind;
  /// 32-byte vault PDA.
  vault: Uint8Array;
  isRotationDrain?: boolean;
  /// 32-byte destination commitment hash for rotation; zeros otherwise.
  destinationAddressHash?: Uint8Array;
  signatureFormat: SignatureFormat;
}

export interface OperatorAttestation {
  participantIndex: number;
  /// 64-byte Ed25519 signature over the I4 attestation payload.
  ed25519Signature: Uint8Array;
  /// 32-byte operator identity verifying key.
  identityPubkey: Uint8Array;
}

export interface RunSigningRoundResponse {
  success: boolean;
  /// 32-byte round id.
  roundId: Uint8Array;
  /// 64-byte aggregated signature.
  finalSignature: Uint8Array;
  attestations: OperatorAttestation[];
  errorMessage: string;
}

export interface RunEcdsaSigningRoundRequest {
  signingRequestPda: Uint8Array;
  msgHash: Uint8Array;
  derivationPathCanonical: Uint8Array;
  derivationPathHash: Uint8Array;
  attemptIndex: number;
  participatingBitmask?: number;
  vault: Uint8Array;
  tenantProgramId: Uint8Array;
  epoch: number;
  sighashKind: SighashKind;
  /// 32-byte tenant authority PDA. Equals `signing_request.tenant`.
  tenantAuthorityPda: Uint8Array;
  /// AssetId byte. 1=Eth, 2=ZecT.
  asset: AssetId;
}

export interface OperatorEcdsaAttestation {
  participantIndex: number;
  /// 65-byte recoverable ECDSA over the I4 payload (r∥s∥v).
  ed25519Signature: Uint8Array;
  identityPubkey: Uint8Array;
  /// 20-byte hash of the operator's secp256k1 identity pubkey.
  ethAddress: Uint8Array;
}

export interface RunEcdsaSigningRoundResponse {
  success: boolean;
  roundId: Uint8Array;
  signatureR: Uint8Array;
  signatureS: Uint8Array;
  recoveryByte: number;
  /// 33-byte tweaked vault pubkey (compressed).
  tweakedPubkeyCompressed: Uint8Array;
  attestations: OperatorEcdsaAttestation[];
  errorMessage: string;
}

export interface BuildAndSignSaplingSpendRequest {
  signingRequestPda: Uint8Array;
  vault: Uint8Array;
  /// 43 raw bytes — bech32 payload of a `zs1…` /
  /// `ztestsapling1…` / `zregtestsapling1…` address. Use
  /// `@causeway-sh/sapling`'s `decodeSaplingAddress` to extract.
  recipientPaymentAddressRaw: Uint8Array;
  amountZat: bigint;
  feeZat: bigint;
  notePosition: bigint;
  /// 32-byte note rcm.
  noteRcm: Uint8Array;
  anchorHeight: number;
  attemptIndex: number;
  participatingBitmask?: number;
}

export interface BuildAndSignSaplingSpendResponse {
  success: boolean;
  /// Broadcast-ready v5 transaction bytes.
  rawTx: Uint8Array;
  /// 32-byte ZIP-244 shielded sighash.
  sighash: Uint8Array;
  /// 32-byte transaction id.
  txid: Uint8Array;
  errorMessage: string;
}

export interface PrepareSaplingSpendRequest {
  vault: Uint8Array;             // 32 bytes
  /// Raw 43-byte bech32 payload (diversifier(11) ‖ pk_d(32)).
  recipientPaymentAddressRaw: Uint8Array;
  amountZat: bigint;
  feeZat: bigint;
  /// 32-byte hash of the canonical derivation path.
  derivationPathHash: Uint8Array;
}

/// Per-user variant of PrepareSaplingSpend. The coordinator restricts
/// input-note selection to notes addressed to the (tenant, user)
/// diversifier so a user can only spend notes deposited to their
/// own derived vault address.
export interface PrepareUserSaplingSpendRequest {
  vault: Uint8Array;
  recipientPaymentAddressRaw: Uint8Array;
  amountZat: bigint;
  feeZat: bigint;
  derivationPathHash: Uint8Array;
  tenantProgramId: Uint8Array;   // 32 bytes
  userPubkey: Uint8Array;        // 32 bytes
}

export interface PrepareSaplingSpendResponse {
  success: boolean;
  /// 32-byte ZIP-244 shielded sighash. Caller commits to this
  /// on-chain via `tenant_demo::initiate_sapling_send`.
  sighashToSign: Uint8Array;
  /// 16-byte opaque session id. Bound to (vault, recipient, amount,
  /// fee, derivation_path_hash); coordinator caches the prepared
  /// (PCZT, alpha, anchor) under it with a TTL.
  sessionId: Uint8Array;
  anchorHeight: number;
  errorMessage: string;
}

export interface RunSaplingSigningRoundRequest {
  sessionId: Uint8Array;          // 16 bytes
  signingRequestPda: Uint8Array;  // 32 bytes
  vault: Uint8Array;              // 32 bytes
  derivationPathHash: Uint8Array; // 32 bytes
  attemptIndex: number;
  participatingBitmask?: number;
}

export interface RunSaplingSigningRoundResponse {
  success: boolean;
  /// 32-byte canonical round id.
  roundId: Uint8Array;
  /// 64-byte aggregated FROST-RedJubjub spend-auth signature. Caller
  /// passes this as `signature_blob` to on-chain `complete_signing`.
  finalSignature: Uint8Array;
  /// Per-operator Ed25519 attestations over the I4 payload hash.
  attestations: OperatorAttestation[];
  /// Broadcast-ready v5 transaction bytes.
  rawTx: Uint8Array;
  /// 32-byte transaction id.
  txid: Uint8Array;
  errorMessage: string;
}

export interface GetSaplingVaultAddressRequest {
  /// Optional. For M2.0 single-vault deployments leave empty; the
  /// coordinator returns the configured vault's zaddr.
  vault?: Uint8Array;
}

export interface GetSaplingVaultAddressResponse {
  success: boolean;
  /// bech32 string (`zs1…` mainnet, `ztestsapling1…` testnet,
  /// `zregtestsapling1…` regtest).
  paymentAddressBech32: string;
  /// Raw 43 bytes — bech32 payload (diversifier(11) ‖ pk_d(32)).
  paymentAddressRaw: Uint8Array;
  /// "mainnet" | "testnet" | "regtest".
  network: string;
  errorMessage: string;
}

export interface GetUserSaplingAddressRequest {
  tenantProgramId: Uint8Array;  // 32 bytes
  userPubkey: Uint8Array;        // 32 bytes
}

export interface GetUserSaplingAddressResponse {
  success: boolean;
  paymentAddressBech32: string;
  paymentAddressRaw: Uint8Array;  // 43 bytes
  network: string;
  diversifier: Uint8Array;        // 11 bytes
  errorMessage: string;
}

export interface GetUserSaplingBalanceRequest {
  tenantProgramId: Uint8Array;
  userPubkey: Uint8Array;
}

export interface GetUserSaplingBalanceResponse {
  success: boolean;
  unspentZat: bigint;
  unspentNoteCount: number;
  lastSeenHeight: bigint;
  errorMessage: string;
}

export interface BroadcastSaplingTxRequest {
  /// v5 Sapling transaction bytes (from RunSaplingSigningRound.rawTx).
  rawTx: Uint8Array;
}

export interface BroadcastSaplingTxResponse {
  success: boolean;
  /// 32-byte transaction id, computed locally by the coordinator from
  /// raw_tx (lightwalletd SendResponse doesn't return one).
  txid: Uint8Array;
  /// Non-zero lightwalletd error code on rejection. 0 on success.
  lwdErrorCode: number;
  errorMessage: string;
}

// ----- Orchard --------------------------------------------------
//
// Orchard mirrors the Sapling per-user flow shape but with a few
// proto-level deltas (network = "main" | "test" | "regtest", balance
// `noteCount` field name, anchorHeight as bigint). Downstream
// `@causeway-sh/orchard` wraps these in user-facing helpers.

export interface GetOrchardVaultAddressRequest {
  /// Optional. Leave empty for single-vault deployments; the
  /// coordinator returns the configured vault's bech32m address.
  vault?: Uint8Array;
}

export interface GetOrchardVaultAddressResponse {
  success: boolean;
  /// bech32m string with HRP `uorchardmain` / `uorchardtest` /
  /// `uorchardreg`. Not a canonical Unified Address — see the
  /// coordinator's `control.rs` for the encoding rationale.
  paymentAddressBech32: string;
  /// Raw 43 bytes — bech32m payload (diversifier(11) ‖ pk_d(32)).
  paymentAddressRaw: Uint8Array;
  /// 11-byte diversifier (first half of the 43-byte payload).
  diversifier: Uint8Array;
  /// "main" | "test" | "regtest".
  network: string;
  errorMessage: string;
}

export interface GetUserOrchardAddressRequest {
  tenantProgramId: Uint8Array;  // 32 bytes
  userPubkey: Uint8Array;       // 32 bytes
}

export interface GetUserOrchardAddressResponse {
  success: boolean;
  paymentAddressBech32: string;
  paymentAddressRaw: Uint8Array;
  diversifier: Uint8Array;
  network: string;
  errorMessage: string;
}

export interface GetUserOrchardBalanceRequest {
  tenantProgramId: Uint8Array;
  userPubkey: Uint8Array;
}

export interface GetUserOrchardBalanceResponse {
  success: boolean;
  unspentZat: bigint;
  /// Number of unspent notes addressed to the user's diversifier.
  noteCount: number;
  lastSeenHeight: bigint;
  errorMessage: string;
}

export interface PrepareUserOrchardSpendRequest {
  vault: Uint8Array;
  /// Raw 43-byte bech32m payload of the recipient's Orchard address.
  recipientPaymentAddressRaw: Uint8Array;
  amountZat: bigint;
  feeZat: bigint;
  derivationPathHash: Uint8Array;
  tenantProgramId: Uint8Array;
  userPubkey: Uint8Array;
}

export interface PrepareOrchardSpendResponse {
  success: boolean;
  /// 32-byte ZIP-244 v5 shielded sighash. Caller commits to this
  /// on-chain via `tenant_demo::initiate_orchard_send`.
  sighashToSign: Uint8Array;
  /// 16-byte opaque session id; coordinator caches the prepared
  /// (PCZT, alpha, anchor) under it with a TTL bounded by the
  /// 80-block anchor-staleness window.
  sessionId: Uint8Array;
  anchorHeight: bigint;
  errorMessage: string;
}

export interface RunOrchardSigningRoundRequest {
  sessionId: Uint8Array;          // 16 bytes
  signingRequestPda: Uint8Array;  // 32 bytes
  vault: Uint8Array;
  derivationPathHash: Uint8Array;
  attemptIndex: number;
  participatingBitmask?: number;
}

export interface RunOrchardSigningRoundResponse {
  success: boolean;
  roundId: Uint8Array;
  /// 64-byte aggregated FROST-RedPallas spend-auth signature.
  finalSignature: Uint8Array;
  attestations: OperatorAttestation[];
  /// Broadcast-ready v5 transaction bytes.
  rawTx: Uint8Array;
  txid: Uint8Array;
  errorMessage: string;
}

export interface BroadcastOrchardTxRequest {
  /// v5 Orchard transaction bytes (from RunOrchardSigningRound.rawTx).
  rawTx: Uint8Array;
}

export interface BroadcastOrchardTxResponse {
  success: boolean;
  txid: Uint8Array;
  lwdErrorCode: number;
  errorMessage: string;
}

// ----- CoordinatorClient interface -------------------------------

export interface CoordinatorClient {
  runSigningRound(req: RunSigningRoundRequest): Promise<RunSigningRoundResponse>;
  runEcdsaSigningRound(
    req: RunEcdsaSigningRoundRequest,
  ): Promise<RunEcdsaSigningRoundResponse>;
  buildAndSignSaplingSpend(
    req: BuildAndSignSaplingSpendRequest,
  ): Promise<BuildAndSignSaplingSpendResponse>;
  prepareSaplingSpend(
    req: PrepareSaplingSpendRequest,
  ): Promise<PrepareSaplingSpendResponse>;
  prepareUserSaplingSpend(
    req: PrepareUserSaplingSpendRequest,
  ): Promise<PrepareSaplingSpendResponse>;
  runSaplingSigningRound(
    req: RunSaplingSigningRoundRequest,
  ): Promise<RunSaplingSigningRoundResponse>;
  getSaplingVaultAddress(
    req?: GetSaplingVaultAddressRequest,
  ): Promise<GetSaplingVaultAddressResponse>;
  broadcastSaplingTx(
    req: BroadcastSaplingTxRequest,
  ): Promise<BroadcastSaplingTxResponse>;
  getUserSaplingAddress(
    req: GetUserSaplingAddressRequest,
  ): Promise<GetUserSaplingAddressResponse>;
  getUserSaplingBalance(
    req: GetUserSaplingBalanceRequest,
  ): Promise<GetUserSaplingBalanceResponse>;
  getOrchardVaultAddress(
    req?: GetOrchardVaultAddressRequest,
  ): Promise<GetOrchardVaultAddressResponse>;
  getUserOrchardAddress(
    req: GetUserOrchardAddressRequest,
  ): Promise<GetUserOrchardAddressResponse>;
  getUserOrchardBalance(
    req: GetUserOrchardBalanceRequest,
  ): Promise<GetUserOrchardBalanceResponse>;
  prepareUserOrchardSpend(
    req: PrepareUserOrchardSpendRequest,
  ): Promise<PrepareOrchardSpendResponse>;
  runOrchardSigningRound(
    req: RunOrchardSigningRoundRequest,
  ): Promise<RunOrchardSigningRoundResponse>;
  broadcastOrchardTx(
    req: BroadcastOrchardTxRequest,
  ): Promise<BroadcastOrchardTxResponse>;
}

// ----- Live gRPC-Web client --------------------------------------

export interface GrpcWebCoordinatorClientOptions {
  /// Base URL of the tonic-web-enabled coordinator. e.g.
  /// `"http://localhost:50090"` for the docker-compose stack or
  /// `"https://coordinator.causeway.sh"` for production.
  baseUrl: string;
  /// Optional fetch implementation. Defaults to globalThis.fetch.
  fetch?: typeof fetch;
}

/// gRPC-Web binary client backed by buf-generated bindings.
///
/// This class is the only part of the SDK that knows the wire format;
/// downstream packages depend on the `CoordinatorClient` interface.
export class GrpcWebCoordinatorClient implements CoordinatorClient {
  private readonly inner: Client<typeof CoordinatorControl>;

  constructor(opts: GrpcWebCoordinatorClientOptions) {
    if (!opts || typeof opts.baseUrl !== "string" || opts.baseUrl.length === 0) {
      throw new Error(
        "GrpcWebCoordinatorClient: { baseUrl } is required. " +
          "Did you pass `{ url }` by mistake? The field is `baseUrl`.",
      );
    }
    const transport: Transport = createGrpcWebTransport({
      baseUrl: opts.baseUrl.replace(/\/+$/, ""),
      fetch: opts.fetch,
    });
    this.inner = createClient(CoordinatorControl, transport);
  }

  async runSigningRound(req: RunSigningRoundRequest): Promise<RunSigningRoundResponse> {
    const resp = await this.inner.runSigningRound({
      signingRequestPda: req.signingRequestPda,
      sighashToSign: req.sighashToSign,
      derivationPathCanonical: req.derivationPathCanonical,
      derivationPathHash: req.derivationPathHash,
      attemptIndex: req.attemptIndex,
      participatingBitmask: req.participatingBitmask ?? 0b001_1111,
      asset: req.asset,
      sighashKind: req.sighashKind,
      vault: req.vault,
      isRotationDrain: req.isRotationDrain ?? false,
      destinationAddressHash: req.destinationAddressHash ?? new Uint8Array(32),
      signatureFormat: req.signatureFormat,
    });
    return {
      success: resp.success,
      roundId: resp.roundId,
      finalSignature: resp.finalSignature,
      attestations: resp.attestations.map((a) => ({
        participantIndex: a.participantIndex,
        ed25519Signature: a.ed25519Signature,
        identityPubkey: a.identityPubkey,
      })),
      errorMessage: resp.errorMessage,
    };
  }

  async runEcdsaSigningRound(
    req: RunEcdsaSigningRoundRequest,
  ): Promise<RunEcdsaSigningRoundResponse> {
    const resp = await this.inner.runEcdsaSigningRound({
      signingRequestPda: req.signingRequestPda,
      msgHash: req.msgHash,
      derivationPathCanonical: req.derivationPathCanonical,
      derivationPathHash: req.derivationPathHash,
      attemptIndex: req.attemptIndex,
      participatingBitmask: req.participatingBitmask ?? 0b001_1111,
      vault: req.vault,
      tenantProgramId: req.tenantProgramId,
      epoch: req.epoch,
      sighashKind: req.sighashKind,
      tenantAuthorityPda: req.tenantAuthorityPda,
      asset: req.asset,
    });
    return {
      success: resp.success,
      roundId: resp.roundId,
      signatureR: resp.signatureR,
      signatureS: resp.signatureS,
      recoveryByte: resp.recoveryByte,
      tweakedPubkeyCompressed: resp.tweakedPubkeyCompressed,
      attestations: resp.attestations.map((a) => ({
        participantIndex: a.participantIndex,
        ed25519Signature: a.ed25519Signature,
        identityPubkey: a.identityPubkey,
        ethAddress: a.ethAddress,
      })),
      errorMessage: resp.errorMessage,
    };
  }

  async buildAndSignSaplingSpend(
    req: BuildAndSignSaplingSpendRequest,
  ): Promise<BuildAndSignSaplingSpendResponse> {
    const resp = await this.inner.buildAndSignSaplingSpend({
      signingRequestPda: req.signingRequestPda,
      vault: req.vault,
      recipientPaymentAddressRaw: req.recipientPaymentAddressRaw,
      amountZat: req.amountZat,
      feeZat: req.feeZat,
      notePosition: req.notePosition,
      noteRcm: req.noteRcm,
      anchorHeight: req.anchorHeight,
      attemptIndex: req.attemptIndex,
      participatingBitmask: req.participatingBitmask ?? 0b001_1111,
    });
    return {
      success: resp.success,
      rawTx: resp.rawTx,
      sighash: resp.sighash,
      txid: resp.txid,
      errorMessage: resp.errorMessage,
    };
  }

  async getSaplingVaultAddress(
    req?: GetSaplingVaultAddressRequest,
  ): Promise<GetSaplingVaultAddressResponse> {
    const resp = await this.inner.getSaplingVaultAddress({
      vault: req?.vault ?? new Uint8Array(),
    });
    return {
      success: resp.success,
      paymentAddressBech32: resp.paymentAddressBech32,
      paymentAddressRaw: resp.paymentAddressRaw,
      network: resp.network,
      errorMessage: resp.errorMessage,
    };
  }

  async prepareSaplingSpend(
    req: PrepareSaplingSpendRequest,
  ): Promise<PrepareSaplingSpendResponse> {
    const resp = await this.inner.prepareSaplingSpend({
      vault: req.vault,
      recipientPaymentAddressRaw: req.recipientPaymentAddressRaw,
      amountZat: req.amountZat,
      feeZat: req.feeZat,
      derivationPathHash: req.derivationPathHash,
    });
    return {
      success: resp.success,
      sighashToSign: resp.sighashToSign,
      sessionId: resp.sessionId,
      anchorHeight: resp.anchorHeight,
      errorMessage: resp.errorMessage,
    };
  }

  async prepareUserSaplingSpend(
    req: PrepareUserSaplingSpendRequest,
  ): Promise<PrepareSaplingSpendResponse> {
    const resp = await this.inner.prepareUserSaplingSpend({
      vault: req.vault,
      recipientPaymentAddressRaw: req.recipientPaymentAddressRaw,
      amountZat: req.amountZat,
      feeZat: req.feeZat,
      derivationPathHash: req.derivationPathHash,
      tenantProgramId: req.tenantProgramId,
      userPubkey: req.userPubkey,
    });
    return {
      success: resp.success,
      sighashToSign: resp.sighashToSign,
      sessionId: resp.sessionId,
      anchorHeight: resp.anchorHeight,
      errorMessage: resp.errorMessage,
    };
  }

  async runSaplingSigningRound(
    req: RunSaplingSigningRoundRequest,
  ): Promise<RunSaplingSigningRoundResponse> {
    const resp = await this.inner.runSaplingSigningRound({
      sessionId: req.sessionId,
      signingRequestPda: req.signingRequestPda,
      vault: req.vault,
      derivationPathHash: req.derivationPathHash,
      attemptIndex: req.attemptIndex,
      participatingBitmask: req.participatingBitmask ?? 0b001_1111,
    });
    return {
      success: resp.success,
      roundId: resp.roundId,
      finalSignature: resp.finalSignature,
      attestations: resp.attestations.map((a) => ({
        participantIndex: a.participantIndex,
        ed25519Signature: a.ed25519Signature,
        identityPubkey: a.identityPubkey,
      })),
      rawTx: resp.rawTx,
      txid: resp.txid,
      errorMessage: resp.errorMessage,
    };
  }

  async broadcastSaplingTx(
    req: BroadcastSaplingTxRequest,
  ): Promise<BroadcastSaplingTxResponse> {
    const resp = await this.inner.broadcastSaplingTx({
      rawTx: req.rawTx,
    });
    return {
      success: resp.success,
      txid: resp.txid,
      lwdErrorCode: resp.lwdErrorCode,
      errorMessage: resp.errorMessage,
    };
  }

  async getUserSaplingAddress(
    req: GetUserSaplingAddressRequest,
  ): Promise<GetUserSaplingAddressResponse> {
    const resp = await this.inner.getUserSaplingAddress({
      tenantProgramId: req.tenantProgramId,
      userPubkey: req.userPubkey,
    });
    return {
      success: resp.success,
      paymentAddressBech32: resp.paymentAddressBech32,
      paymentAddressRaw: resp.paymentAddressRaw,
      network: resp.network,
      diversifier: resp.diversifier,
      errorMessage: resp.errorMessage,
    };
  }

  async getUserSaplingBalance(
    req: GetUserSaplingBalanceRequest,
  ): Promise<GetUserSaplingBalanceResponse> {
    const resp = await this.inner.getUserSaplingBalance({
      tenantProgramId: req.tenantProgramId,
      userPubkey: req.userPubkey,
    });
    return {
      success: resp.success,
      unspentZat: resp.unspentZat,
      unspentNoteCount: resp.unspentNoteCount,
      lastSeenHeight: resp.lastSeenHeight,
      errorMessage: resp.errorMessage,
    };
  }

  async getOrchardVaultAddress(
    req?: GetOrchardVaultAddressRequest,
  ): Promise<GetOrchardVaultAddressResponse> {
    const resp = await this.inner.getOrchardVaultAddress({
      vault: req?.vault ?? new Uint8Array(),
    });
    return {
      success: resp.success,
      paymentAddressBech32: resp.paymentAddressBech32,
      paymentAddressRaw: resp.paymentAddressRaw,
      diversifier: resp.diversifier,
      network: resp.network,
      errorMessage: resp.errorMessage,
    };
  }

  async getUserOrchardAddress(
    req: GetUserOrchardAddressRequest,
  ): Promise<GetUserOrchardAddressResponse> {
    const resp = await this.inner.getUserOrchardAddress({
      tenantProgramId: req.tenantProgramId,
      userPubkey: req.userPubkey,
    });
    return {
      success: resp.success,
      paymentAddressBech32: resp.paymentAddressBech32,
      paymentAddressRaw: resp.paymentAddressRaw,
      diversifier: resp.diversifier,
      network: resp.network,
      errorMessage: resp.errorMessage,
    };
  }

  async getUserOrchardBalance(
    req: GetUserOrchardBalanceRequest,
  ): Promise<GetUserOrchardBalanceResponse> {
    const resp = await this.inner.getUserOrchardBalance({
      tenantProgramId: req.tenantProgramId,
      userPubkey: req.userPubkey,
    });
    return {
      success: resp.success,
      unspentZat: resp.unspentZat,
      noteCount: resp.noteCount,
      lastSeenHeight: resp.lastSeenHeight,
      errorMessage: resp.errorMessage,
    };
  }

  async prepareUserOrchardSpend(
    req: PrepareUserOrchardSpendRequest,
  ): Promise<PrepareOrchardSpendResponse> {
    const resp = await this.inner.prepareUserOrchardSpend({
      vault: req.vault,
      recipientPaymentAddressRaw: req.recipientPaymentAddressRaw,
      amountZat: req.amountZat,
      feeZat: req.feeZat,
      derivationPathHash: req.derivationPathHash,
      tenantProgramId: req.tenantProgramId,
      userPubkey: req.userPubkey,
    });
    return {
      success: resp.success,
      sighashToSign: resp.sighashToSign,
      sessionId: resp.sessionId,
      anchorHeight: resp.anchorHeight,
      errorMessage: resp.errorMessage,
    };
  }

  async runOrchardSigningRound(
    req: RunOrchardSigningRoundRequest,
  ): Promise<RunOrchardSigningRoundResponse> {
    const resp = await this.inner.runOrchardSigningRound({
      sessionId: req.sessionId,
      signingRequestPda: req.signingRequestPda,
      vault: req.vault,
      derivationPathHash: req.derivationPathHash,
      attemptIndex: req.attemptIndex,
      participatingBitmask: req.participatingBitmask ?? 0b001_1111,
    });
    return {
      success: resp.success,
      roundId: resp.roundId,
      finalSignature: resp.finalSignature,
      attestations: resp.attestations.map((a) => ({
        participantIndex: a.participantIndex,
        ed25519Signature: a.ed25519Signature,
        identityPubkey: a.identityPubkey,
      })),
      rawTx: resp.rawTx,
      txid: resp.txid,
      errorMessage: resp.errorMessage,
    };
  }

  async broadcastOrchardTx(
    req: BroadcastOrchardTxRequest,
  ): Promise<BroadcastOrchardTxResponse> {
    const resp = await this.inner.broadcastOrchardTx({
      rawTx: req.rawTx,
    });
    return {
      success: resp.success,
      txid: resp.txid,
      lwdErrorCode: resp.lwdErrorCode,
      errorMessage: resp.errorMessage,
    };
  }
}

// ----- Mock client for unit tests --------------------------------

export class MockCoordinatorClient implements CoordinatorClient {
  constructor(
    private readonly responses: {
      runSigningRound?: (req: RunSigningRoundRequest) => Promise<RunSigningRoundResponse>;
      runEcdsaSigningRound?: (
        req: RunEcdsaSigningRoundRequest,
      ) => Promise<RunEcdsaSigningRoundResponse>;
      buildAndSignSaplingSpend?: (
        req: BuildAndSignSaplingSpendRequest,
      ) => Promise<BuildAndSignSaplingSpendResponse>;
      prepareSaplingSpend?: (
        req: PrepareSaplingSpendRequest,
      ) => Promise<PrepareSaplingSpendResponse>;
      prepareUserSaplingSpend?: (
        req: PrepareUserSaplingSpendRequest,
      ) => Promise<PrepareSaplingSpendResponse>;
      runSaplingSigningRound?: (
        req: RunSaplingSigningRoundRequest,
      ) => Promise<RunSaplingSigningRoundResponse>;
      getSaplingVaultAddress?: (
        req?: GetSaplingVaultAddressRequest,
      ) => Promise<GetSaplingVaultAddressResponse>;
      broadcastSaplingTx?: (
        req: BroadcastSaplingTxRequest,
      ) => Promise<BroadcastSaplingTxResponse>;
      getUserSaplingAddress?: (
        req: GetUserSaplingAddressRequest,
      ) => Promise<GetUserSaplingAddressResponse>;
      getUserSaplingBalance?: (
        req: GetUserSaplingBalanceRequest,
      ) => Promise<GetUserSaplingBalanceResponse>;
      getOrchardVaultAddress?: (
        req?: GetOrchardVaultAddressRequest,
      ) => Promise<GetOrchardVaultAddressResponse>;
      getUserOrchardAddress?: (
        req: GetUserOrchardAddressRequest,
      ) => Promise<GetUserOrchardAddressResponse>;
      getUserOrchardBalance?: (
        req: GetUserOrchardBalanceRequest,
      ) => Promise<GetUserOrchardBalanceResponse>;
      prepareUserOrchardSpend?: (
        req: PrepareUserOrchardSpendRequest,
      ) => Promise<PrepareOrchardSpendResponse>;
      runOrchardSigningRound?: (
        req: RunOrchardSigningRoundRequest,
      ) => Promise<RunOrchardSigningRoundResponse>;
      broadcastOrchardTx?: (
        req: BroadcastOrchardTxRequest,
      ) => Promise<BroadcastOrchardTxResponse>;
    },
  ) {}

  runSigningRound(req: RunSigningRoundRequest): Promise<RunSigningRoundResponse> {
    if (!this.responses.runSigningRound) throw new Error("mock: runSigningRound not scripted");
    return this.responses.runSigningRound(req);
  }

  runEcdsaSigningRound(
    req: RunEcdsaSigningRoundRequest,
  ): Promise<RunEcdsaSigningRoundResponse> {
    if (!this.responses.runEcdsaSigningRound)
      throw new Error("mock: runEcdsaSigningRound not scripted");
    return this.responses.runEcdsaSigningRound(req);
  }

  buildAndSignSaplingSpend(
    req: BuildAndSignSaplingSpendRequest,
  ): Promise<BuildAndSignSaplingSpendResponse> {
    if (!this.responses.buildAndSignSaplingSpend)
      throw new Error("mock: buildAndSignSaplingSpend not scripted");
    return this.responses.buildAndSignSaplingSpend(req);
  }

  prepareSaplingSpend(
    req: PrepareSaplingSpendRequest,
  ): Promise<PrepareSaplingSpendResponse> {
    if (!this.responses.prepareSaplingSpend)
      throw new Error("mock: prepareSaplingSpend not scripted");
    return this.responses.prepareSaplingSpend(req);
  }

  prepareUserSaplingSpend(
    req: PrepareUserSaplingSpendRequest,
  ): Promise<PrepareSaplingSpendResponse> {
    if (!this.responses.prepareUserSaplingSpend)
      throw new Error("mock: prepareUserSaplingSpend not scripted");
    return this.responses.prepareUserSaplingSpend(req);
  }

  runSaplingSigningRound(
    req: RunSaplingSigningRoundRequest,
  ): Promise<RunSaplingSigningRoundResponse> {
    if (!this.responses.runSaplingSigningRound)
      throw new Error("mock: runSaplingSigningRound not scripted");
    return this.responses.runSaplingSigningRound(req);
  }

  getSaplingVaultAddress(
    req?: GetSaplingVaultAddressRequest,
  ): Promise<GetSaplingVaultAddressResponse> {
    if (!this.responses.getSaplingVaultAddress)
      throw new Error("mock: getSaplingVaultAddress not scripted");
    return this.responses.getSaplingVaultAddress(req);
  }

  broadcastSaplingTx(
    req: BroadcastSaplingTxRequest,
  ): Promise<BroadcastSaplingTxResponse> {
    if (!this.responses.broadcastSaplingTx)
      throw new Error("mock: broadcastSaplingTx not scripted");
    return this.responses.broadcastSaplingTx(req);
  }

  getUserSaplingAddress(
    req: GetUserSaplingAddressRequest,
  ): Promise<GetUserSaplingAddressResponse> {
    if (!this.responses.getUserSaplingAddress)
      throw new Error("mock: getUserSaplingAddress not scripted");
    return this.responses.getUserSaplingAddress(req);
  }

  getUserSaplingBalance(
    req: GetUserSaplingBalanceRequest,
  ): Promise<GetUserSaplingBalanceResponse> {
    if (!this.responses.getUserSaplingBalance)
      throw new Error("mock: getUserSaplingBalance not scripted");
    return this.responses.getUserSaplingBalance(req);
  }

  getOrchardVaultAddress(
    req?: GetOrchardVaultAddressRequest,
  ): Promise<GetOrchardVaultAddressResponse> {
    if (!this.responses.getOrchardVaultAddress)
      throw new Error("mock: getOrchardVaultAddress not scripted");
    return this.responses.getOrchardVaultAddress(req);
  }

  getUserOrchardAddress(
    req: GetUserOrchardAddressRequest,
  ): Promise<GetUserOrchardAddressResponse> {
    if (!this.responses.getUserOrchardAddress)
      throw new Error("mock: getUserOrchardAddress not scripted");
    return this.responses.getUserOrchardAddress(req);
  }

  getUserOrchardBalance(
    req: GetUserOrchardBalanceRequest,
  ): Promise<GetUserOrchardBalanceResponse> {
    if (!this.responses.getUserOrchardBalance)
      throw new Error("mock: getUserOrchardBalance not scripted");
    return this.responses.getUserOrchardBalance(req);
  }

  prepareUserOrchardSpend(
    req: PrepareUserOrchardSpendRequest,
  ): Promise<PrepareOrchardSpendResponse> {
    if (!this.responses.prepareUserOrchardSpend)
      throw new Error("mock: prepareUserOrchardSpend not scripted");
    return this.responses.prepareUserOrchardSpend(req);
  }

  runOrchardSigningRound(
    req: RunOrchardSigningRoundRequest,
  ): Promise<RunOrchardSigningRoundResponse> {
    if (!this.responses.runOrchardSigningRound)
      throw new Error("mock: runOrchardSigningRound not scripted");
    return this.responses.runOrchardSigningRound(req);
  }

  broadcastOrchardTx(
    req: BroadcastOrchardTxRequest,
  ): Promise<BroadcastOrchardTxResponse> {
    if (!this.responses.broadcastOrchardTx)
      throw new Error("mock: broadcastOrchardTx not scripted");
    return this.responses.broadcastOrchardTx(req);
  }
}
