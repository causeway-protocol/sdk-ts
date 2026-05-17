// Mempool.space REST client for public-network broadcasts and UTXO
// discovery. Public-net flows (testnet4, mainnet) talk to
// mempool.space (or any Esplora-compatible endpoint) over plain HTTPS;
// no auth, no JSON-RPC.

export type MempoolNetwork =
  | "mainnet"
  | "testnet"
  | "testnet4"
  | "signet";

export interface MempoolUtxo {
  txid: string;
  vout: number;
  value: number; // sats
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
}

export interface MempoolSpaceClientOptions {
  /// Network to talk to. Picks the right URL prefix:
  ///   mainnet  → https://mempool.space/api
  ///   testnet  → https://mempool.space/testnet/api
  ///   testnet4 → https://mempool.space/testnet4/api
  ///   signet   → https://mempool.space/signet/api
  network?: MempoolNetwork;
  /// Override the API base URL entirely (e.g. for self-hosted Esplora).
  /// Should NOT have a trailing slash and should NOT include the
  /// network-specific path segment — the client will append `/address/…`
  /// and `/tx` directly.
  baseUrl?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

function defaultBaseUrl(net: MempoolNetwork): string {
  switch (net) {
    case "mainnet":
      return "https://mempool.space/api";
    case "testnet":
      return "https://mempool.space/testnet/api";
    case "testnet4":
      return "https://mempool.space/testnet4/api";
    case "signet":
      return "https://mempool.space/signet/api";
  }
}

export class MempoolSpaceClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(opts: MempoolSpaceClientOptions = {}) {
    if (opts.baseUrl) {
      this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    } else {
      this.baseUrl = defaultBaseUrl(opts.network ?? "mainnet");
    }
    this.fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = opts.timeoutMs ?? 30_000;
  }

  /// `GET /address/{address}/utxo` — list confirmed + unconfirmed UTXOs.
  async listUtxos(address: string): Promise<MempoolUtxo[]> {
    const r = await this.fetchTimeout(
      `${this.baseUrl}/address/${address}/utxo`,
    );
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      throw new Error(`mempool.space listUtxos(${address}) failed: ${r.status} ${text}`);
    }
    return (await r.json()) as MempoolUtxo[];
  }

  /// `POST /tx` — broadcast a signed transaction (hex body). Returns
  /// the txid the server assigned.
  async sendRawTransaction(rawTxHex: string): Promise<string> {
    const r = await this.fetchTimeout(`${this.baseUrl}/tx`, {
      method: "POST",
      body: rawTxHex,
      headers: { "Content-Type": "text/plain" },
    });
    const text = await r.text();
    if (!r.ok) {
      throw new Error(`mempool.space sendRawTransaction failed: ${r.status} ${text}`);
    }
    return text.trim();
  }

  /// `GET /blocks/tip/height` — current chain tip height. Useful for
  /// estimating deadline_slot equivalents or UI confirmations.
  async getTipHeight(): Promise<number> {
    const r = await this.fetchTimeout(`${this.baseUrl}/blocks/tip/height`);
    if (!r.ok) {
      throw new Error(`mempool.space getTipHeight failed: ${r.status}`);
    }
    return parseInt((await r.text()).trim(), 10);
  }

  private async fetchTimeout(
    url: string,
    init?: RequestInit,
  ): Promise<Response> {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(url, { ...init, signal: ctrl.signal });
    } finally {
      clearTimeout(tid);
    }
  }
}
