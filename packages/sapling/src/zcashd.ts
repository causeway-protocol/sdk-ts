// Minimal zcashd JSON-RPC client. Used by `sendToZaddr` to broadcast
// the coordinator-returned raw_tx via `sendrawtransaction`. We avoid
// pulling a full zcash library — the broadcast flow needs exactly
// one method call.
//
// `fetch` rejects URLs containing inline credentials (HTTP Basic),
// so callers pass `(url, user, pass)` and we set the Authorization
// header explicitly.

export interface ZcashdRpc {
  /// Base URL, e.g. `"http://localhost:18232"`. Should NOT contain
  /// embedded `user:pass@` credentials — set them via `user`/`password`.
  url: string;
  user: string;
  password: string;
  /// Optional fetch implementation. Defaults to globalThis.fetch.
  fetch?: typeof fetch;
}

export interface ZcashdRpcError {
  code: number;
  message: string;
}

export class ZcashdRpcCallError extends Error {
  constructor(
    public readonly method: string,
    public readonly rpcError: ZcashdRpcError,
  ) {
    super(`zcashd ${method}: ${rpcError.code}: ${rpcError.message}`);
    this.name = "ZcashdRpcCallError";
  }
}

function authHeader(user: string, password: string): string {
  // Browser-safe base64 of `user:password`. Works in node 20+ (btoa)
  // and any modern browser.
  return "Basic " + btoa(`${user}:${password}`);
}

export async function zcashdRpcCall<T>(
  rpc: ZcashdRpc,
  method: string,
  params: unknown[] = [],
): Promise<T> {
  const f = rpc.fetch ?? globalThis.fetch.bind(globalThis);
  const r = await f(rpc.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(rpc.user, rpc.password),
    },
    body: JSON.stringify({ jsonrpc: "1.0", id: "causeway-sdk", method, params }),
  });
  const j = (await r.json()) as { result?: T; error?: ZcashdRpcError };
  if (j.error) throw new ZcashdRpcCallError(method, j.error);
  return j.result as T;
}

function bytesToHex(b: Uint8Array): string {
  let s = "";
  for (const byte of b) s += byte.toString(16).padStart(2, "0");
  return s;
}

/// Broadcast a raw v5 transaction. Returns the txid string from zcashd.
export async function sendRawTransaction(rpc: ZcashdRpc, rawTx: Uint8Array): Promise<string> {
  return zcashdRpcCall<string>(rpc, "sendrawtransaction", [bytesToHex(rawTx)]);
}
