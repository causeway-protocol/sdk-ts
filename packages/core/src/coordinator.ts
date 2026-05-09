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
// (`@causeway-sh/{evm,zec,btc,sapling}`) depend on the interface,
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

// ----- CoordinatorClient interface -------------------------------

export interface CoordinatorClient {
  runSigningRound(req: RunSigningRoundRequest): Promise<RunSigningRoundResponse>;
  runEcdsaSigningRound(
    req: RunEcdsaSigningRoundRequest,
  ): Promise<RunEcdsaSigningRoundResponse>;
  buildAndSignSaplingSpend(
    req: BuildAndSignSaplingSpendRequest,
  ): Promise<BuildAndSignSaplingSpendResponse>;
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
}
