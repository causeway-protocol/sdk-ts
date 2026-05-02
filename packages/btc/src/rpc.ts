// Minimal bitcoind JSON-RPC client. Used by the M1.0 demo CLI's
// broadcast path; dApps usually bring their own (BlockCypher, Esplora,
// etc.) — this is a convenience for the docker-compose flow.

export interface BitcoindRpcOptions {
  /// `http://user:pass@host:port` (or `https://...`) for the bitcoind
  /// JSON-RPC endpoint.
  url: string;
  /// Optional fetch implementation.
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export class BitcoindRpcClient {
  private readonly url: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(opts: BitcoindRpcOptions) {
    this.url = opts.url;
    this.fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = opts.timeoutMs ?? 30_000;
  }

  /// Submit signed raw transaction hex; returns the txid.
  async sendRawTransaction(rawTxHex: string): Promise<string> {
    return (await this.call("sendrawtransaction", [rawTxHex])) as string;
  }

  async getTxOut(txid: string, vout: number): Promise<{
    value: number;
    scriptPubKey: { hex: string };
    confirmations: number;
  } | null> {
    return (await this.call("gettxout", [txid, vout, true])) as any;
  }

  async getBlockCount(): Promise<number> {
    return (await this.call("getblockcount", [])) as number;
  }

  private async call(method: string, params: unknown[]): Promise<unknown> {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const resp = await this.fetchImpl(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "1.0",
          id: "@causeway-sh/btc",
          method,
          params,
        }),
        signal: ctrl.signal,
      });
      const json = (await resp.json()) as { result: unknown; error: { code: number; message: string } | null };
      if (json.error) {
        throw new Error(`bitcoind ${method} failed: ${json.error.code} ${json.error.message}`);
      }
      return json.result;
    } finally {
      clearTimeout(tid);
    }
  }
}
