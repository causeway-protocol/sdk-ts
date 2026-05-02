// lightwalletd gRPC-Web client.
//
// Spec'd against `cli/proto/lwd/service.proto`. The buf-generated
// bindings would land alongside this file (`gen/service_pb.ts`); for
// v0.1.0-alpha.0 we ship a hand-rolled JSON-over-gRPC-Web fallback so
// the high-level interface dApps consume is stable.

export interface LightwalletdClientOptions {
  /// Base URL of the lightwalletd endpoint with `tonic-web` enabled.
  /// Examples: `"https://testnet.zec.rocks:443"`, `"https://zec.rocks:443"`,
  /// or `"http://localhost:9067"` for the docker-compose stack.
  baseUrl: string;
  /// Optional fetch implementation (for tests / non-browser runtimes).
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export interface LightdInfo {
  version: string;
  chainName: string;
  consensusBranchId: string;
  saplingActivationHeight: bigint;
  blockHeight: bigint;
}

export interface Utxo {
  address: string;
  txid: Uint8Array; // 32 bytes
  index: number;
  scriptPubkey: Uint8Array;
  valueZat: bigint;
  height: bigint;
}

export class LightwalletdClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(opts: LightwalletdClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = opts.timeoutMs ?? 30_000;
  }

  async getLightdInfo(): Promise<LightdInfo> {
    const r = (await this.callJson("GetLightdInfo", {})) as {
      version: string;
      chainName: string;
      consensusBranchId: string;
      saplingActivationHeight: string | number | bigint;
      blockHeight: string | number | bigint;
    };
    return {
      version: r.version,
      chainName: r.chainName,
      consensusBranchId: r.consensusBranchId,
      saplingActivationHeight: BigInt(r.saplingActivationHeight),
      blockHeight: BigInt(r.blockHeight),
    };
  }

  async getAddressUtxos(addresses: string[]): Promise<Utxo[]> {
    const r = (await this.callJson("GetAddressUtxos", {
      addresses,
      startHeight: "0",
      maxEntries: 100,
    })) as { addressUtxos?: Array<{
      address: string;
      txid: number[];
      index: number;
      script: number[];
      valueZat: string | number;
      height: string | number;
    }> };
    const out: Utxo[] = [];
    for (const u of r.addressUtxos ?? []) {
      out.push({
        address: u.address,
        txid: new Uint8Array(u.txid),
        index: u.index,
        scriptPubkey: new Uint8Array(u.script),
        valueZat: BigInt(u.valueZat),
        height: BigInt(u.height),
      });
    }
    return out;
  }

  /// Submit a fully-signed v5 raw transaction. Returns the lightwalletd
  /// response; callers typically check `errorCode === 0`.
  async sendTransaction(rawTx: Uint8Array): Promise<{ errorCode: number; errorMessage?: string }> {
    return (await this.callJson("SendTransaction", {
      data: Array.from(rawTx),
      height: "0",
    })) as { errorCode: number; errorMessage?: string };
  }

  private async callJson(method: string, body: unknown): Promise<unknown> {
    const url = `${this.baseUrl}/cash.z.wallet.sdk.rpc.CompactTxStreamer/${method}`;
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const resp = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Connect-Protocol-Version": "1",
        },
        body: JSON.stringify(body, (_k, v) =>
          v instanceof Uint8Array ? Array.from(v) : typeof v === "bigint" ? v.toString() : v,
        ),
        signal: ctrl.signal,
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`lightwalletd ${method} failed: HTTP ${resp.status}: ${text}`);
      }
      return await resp.json();
    } finally {
      clearTimeout(tid);
    }
  }
}
