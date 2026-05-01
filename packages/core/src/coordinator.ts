// Coordinator gRPC-Web client.
//
// Spike B picked `@bufbuild/protoc-gen-es` + `@connectrpc/connect-web`
// as the toolchain. The buf-generated bindings live alongside this
// file (under `gen/` after `buf generate`); this module wraps them in
// the high-level `CoordinatorClient` interface that dApps consume.
//
// For v0.1.0-alpha.0 the buf-generated code is stubbed — the
// interface and hand-rolled JSON-over-gRPC-Web fallback below let
// downstream packages (`@causeway-sh/{evm,zec,btc}`) typecheck and
// integration-test against a live coordinator now. The buf-generated
// path lands when we run `buf generate` against the main-repo
// `coordinator/proto/coordinator_control.proto` as part of the
// publish runbook.

import type { AssetId, SighashKind, SignatureFormat } from "./enums.js";

export interface RunSigningRoundRequest {
  requestId: Uint8Array;        // 32
  asset: AssetId;
  payloadHash: Uint8Array;      // 32
  sighashKind: SighashKind;
  /// Subset of operators participating, encoded as a 7-bit bitmask.
  /// Coordinator picks 5-of-7 by default; callers can override for
  /// recovery flows.
  participatingBitmask?: number;
}

export interface OperatorAttestation {
  operatorIndex: number;
  signature: Uint8Array;
}

export interface RunSigningRoundResponse {
  /// 64-byte aggregated signature (BIP-340 Schnorr for BTC, RedDSA64
  /// for shielded).
  signature: Uint8Array;
  signatureFormat: SignatureFormat;
  attestations: OperatorAttestation[];
}

export interface RunEcdsaSigningRoundRequest extends RunSigningRoundRequest {}
export interface RunEcdsaSigningRoundResponse extends RunSigningRoundResponse {
  /// 0 or 1, the y-parity of the recovered ECDSA signature.
  recoveryId: number;
}

export interface CoordinatorClient {
  runSigningRound(req: RunSigningRoundRequest): Promise<RunSigningRoundResponse>;
  runEcdsaSigningRound(req: RunEcdsaSigningRoundRequest): Promise<RunEcdsaSigningRoundResponse>;
}

export interface GrpcWebCoordinatorClientOptions {
  /// Base URL of the tonic-web-enabled coordinator. Example:
  /// `"https://coordinator.causeway.sh"` or `"http://localhost:50090"`
  /// for the docker-compose stack.
  baseUrl: string;
  /// Optional fetch implementation (for tests / non-browser runtimes).
  fetch?: typeof fetch;
  /// Per-request timeout in ms. Default 30s.
  timeoutMs?: number;
}

/// Minimal gRPC-Web wire client. Speaks the Connect protocol over
/// fetch — no extra browser shims needed. Once the buf-generated
/// bindings drop in, this class swaps to use them while keeping the
/// same external interface.
export class GrpcWebCoordinatorClient implements CoordinatorClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(opts: GrpcWebCoordinatorClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = opts.timeoutMs ?? 30_000;
  }

  async runSigningRound(req: RunSigningRoundRequest): Promise<RunSigningRoundResponse> {
    return this.callJson("RunSigningRound", req) as Promise<RunSigningRoundResponse>;
  }

  async runEcdsaSigningRound(
    req: RunEcdsaSigningRoundRequest,
  ): Promise<RunEcdsaSigningRoundResponse> {
    return this.callJson(
      "RunEcdsaSigningRound",
      req,
    ) as Promise<RunEcdsaSigningRoundResponse>;
  }

  private async callJson(
    method: "RunSigningRound" | "RunEcdsaSigningRound",
    req: unknown,
  ): Promise<unknown> {
    const url = `${this.baseUrl}/causeway.coordinator.v1.CoordinatorControl/${method}`;
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const resp = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Connect-Protocol-Version": "1",
        },
        body: JSON.stringify(req, (_k, v) => (v instanceof Uint8Array ? Array.from(v) : v)),
        signal: ctrl.signal,
      });
      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        throw new Error(`coordinator ${method} failed: HTTP ${resp.status}: ${body}`);
      }
      return await resp.json();
    } finally {
      clearTimeout(tid);
    }
  }
}

/// Mock client for unit tests. Returns whatever the caller scripted.
export class MockCoordinatorClient implements CoordinatorClient {
  constructor(
    private readonly responses: {
      runSigningRound?: (req: RunSigningRoundRequest) => Promise<RunSigningRoundResponse>;
      runEcdsaSigningRound?: (
        req: RunEcdsaSigningRoundRequest,
      ) => Promise<RunEcdsaSigningRoundResponse>;
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
}
