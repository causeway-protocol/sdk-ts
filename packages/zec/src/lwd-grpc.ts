// Binary gRPC client for lightwalletd over HTTP/2.
//
// Public lightwalletd endpoints (zec.rocks, mainnet.lightwalletd.com,
// the in-protocol coordinator's upstream) speak only canonical binary
// gRPC over HTTP/2 — the Connect/JSON path returns HTTP 404, and the
// gRPC-Web translation isn't enabled either.
//
// `LightwalletdClient` (in `./lwd.ts`) speaks the JSON path and is
// useful for the docker-compose stack with `tonic-web` enabled.
// `LightwalletdGrpcClient` (this file) speaks raw gRPC and works
// against public mainnet/testnet endpoints. It depends on `node:http2`
// so it's Node-only (browsers should use the JSON client + a proxy).
//
// We hand-roll a small protobuf wire codec for the 4 message types we
// actually touch (LightdInfo / GetAddressUtxosArg / SendTxRequest /
// SendResponse + the UTXO list element) so this stays buf-codegen-free.

import http2 from "node:http2";

const SERVICE = "cash.z.wallet.sdk.rpc.CompactTxStreamer";

// ─────────────────────── protobuf wire helpers ───────────────────────

const enum WireType {
  VARINT = 0,
  I64 = 1,
  LEN = 2,
  I32 = 5,
}

function encodeVarint(n: bigint): Uint8Array {
  const out: number[] = [];
  let v = n;
  while (v > 0x7fn) {
    out.push(Number((v & 0x7fn) | 0x80n));
    v >>= 7n;
  }
  out.push(Number(v));
  return new Uint8Array(out);
}

function encodeTag(field: number, wt: WireType): Uint8Array {
  return encodeVarint(BigInt((field << 3) | wt));
}

function encodeLenDelimited(field: number, bytes: Uint8Array): Uint8Array {
  return concat([
    encodeTag(field, WireType.LEN),
    encodeVarint(BigInt(bytes.length)),
    bytes,
  ]);
}

function encodeUint64(field: number, v: bigint): Uint8Array {
  if (v === 0n) return new Uint8Array();
  return concat([encodeTag(field, WireType.VARINT), encodeVarint(v)]);
}

function encodeUint32(field: number, v: number): Uint8Array {
  if (v === 0) return new Uint8Array();
  return concat([encodeTag(field, WireType.VARINT), encodeVarint(BigInt(v))]);
}

function encodeString(field: number, s: string): Uint8Array {
  return encodeLenDelimited(field, new TextEncoder().encode(s));
}

function encodeBytes(field: number, b: Uint8Array): Uint8Array {
  return encodeLenDelimited(field, b);
}

function concat(xs: Uint8Array[]): Uint8Array {
  const total = xs.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const x of xs) {
    out.set(x, o);
    o += x.length;
  }
  return out;
}

class Reader {
  pos = 0;
  constructor(public buf: Uint8Array) {}
  eof() {
    return this.pos >= this.buf.length;
  }
  varint(): bigint {
    let v = 0n;
    let shift = 0n;
    while (true) {
      const b = this.buf[this.pos++];
      if (b === undefined) throw new Error("varint truncated");
      v |= BigInt(b & 0x7f) << shift;
      if ((b & 0x80) === 0) return v;
      shift += 7n;
    }
  }
  bytes(): Uint8Array {
    const len = Number(this.varint());
    const out = this.buf.subarray(this.pos, this.pos + len);
    this.pos += len;
    return out;
  }
  skip(wt: WireType) {
    switch (wt) {
      case WireType.VARINT:
        this.varint();
        return;
      case WireType.I64:
        this.pos += 8;
        return;
      case WireType.LEN: {
        const len = Number(this.varint());
        this.pos += len;
        return;
      }
      case WireType.I32:
        this.pos += 4;
        return;
      default:
        throw new Error(`unknown wire type: ${wt}`);
    }
  }
}

// ─────────────────────── gRPC framing ──────────────────────────────

/// `[0x00 (no-compression) || u32_be(len) || payload]`.
function grpcFrame(payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(5 + payload.length);
  new DataView(out.buffer).setUint32(1, payload.length, false);
  out.set(payload, 5);
  return out;
}

function unframeGrpc(buf: Uint8Array): Uint8Array {
  if (buf.length < 5) throw new Error(`gRPC response too short: ${buf.length}`);
  if (buf[0] !== 0x00) {
    throw new Error(`expected uncompressed message frame, got 0x${buf[0]!.toString(16)}`);
  }
  const len = new DataView(buf.buffer, buf.byteOffset, buf.byteLength).getUint32(1, false);
  return buf.subarray(5, 5 + len);
}

// ─────────────────────── HTTP/2 transport ──────────────────────────

interface H2Response {
  headers: http2.IncomingHttpHeaders & http2.IncomingHttpStatusHeader;
  trailers: http2.IncomingHttpHeaders;
  body: Uint8Array;
}

function callH2(
  baseUrl: string,
  method: string,
  reqBody: Uint8Array,
  timeoutMs: number,
): Promise<H2Response> {
  return new Promise((resolve, reject) => {
    const session = http2.connect(baseUrl);
    const timer = setTimeout(() => {
      session.destroy(new Error(`timeout after ${timeoutMs}ms`));
      reject(new Error(`${method} timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    session.on("error", (e) => {
      clearTimeout(timer);
      reject(new Error(`${method} session error: ${e.message}`));
    });

    const req = session.request({
      ":method": "POST",
      ":path": `/${SERVICE}/${method}`,
      "content-type": "application/grpc",
      te: "trailers",
    });

    let respHeaders: H2Response["headers"] = {} as H2Response["headers"];
    let respTrailers: http2.IncomingHttpHeaders = {};
    const chunks: Buffer[] = [];

    req.on("response", (h) => {
      respHeaders = h;
    });
    req.on("trailers", (t) => {
      respTrailers = t;
    });
    req.on("data", (c) => {
      chunks.push(typeof c === "string" ? Buffer.from(c, "binary") : (c as Buffer));
    });
    req.on("end", () => {
      clearTimeout(timer);
      session.close();
      resolve({
        headers: respHeaders,
        trailers: respTrailers,
        body: new Uint8Array(Buffer.concat(chunks)),
      });
    });
    req.on("error", (e) => {
      clearTimeout(timer);
      session.close();
      reject(new Error(`${method} request error: ${e.message}`));
    });

    req.end(Buffer.from(grpcFrame(reqBody)));
  });
}

function readGrpcStatus(resp: H2Response): { code: number; message: string } {
  // grpc-status MAY be in trailers (canonical) or headers (Trailers-Only response).
  const h = resp.trailers["grpc-status"] ?? resp.headers["grpc-status"];
  const m = resp.trailers["grpc-message"] ?? resp.headers["grpc-message"];
  const code = h === undefined ? 0 : parseInt(Array.isArray(h) ? h[0]! : h, 10);
  const message = m === undefined ? "" : Array.isArray(m) ? m[0]! : m;
  return { code, message };
}

async function call(
  baseUrl: string,
  method: string,
  reqBody: Uint8Array,
  timeoutMs: number,
): Promise<Uint8Array> {
  const resp = await callH2(baseUrl, method, reqBody, timeoutMs);
  const status = resp.headers[":status"];
  if (status !== 200) {
    throw new Error(`${method} HTTP ${status}`);
  }
  const grpc = readGrpcStatus(resp);
  if (grpc.code !== 0) {
    throw new Error(`gRPC ${method} status=${grpc.code} ${grpc.message}`);
  }
  if (resp.body.length === 0) return resp.body;
  return unframeGrpc(resp.body);
}

// ─────────────────────── typed RPCs ────────────────────────────────

export interface LightdInfoGrpc {
  version: string;
  chainName: string;
  /// Decoded from the hex-string `consensusBranchId` field on the wire.
  consensusBranchId: number;
  saplingActivationHeight: bigint;
  blockHeight: bigint;
}

export interface UtxoEntryGrpc {
  address: string;
  /// 32-byte txid in the **internal/LE** ordering used by the v5
  /// `prev_outpoint`. The explorer-visible form is its byte-reversal.
  txid: Uint8Array;
  index: number;
  scriptPubkey: Uint8Array;
  valueZat: bigint;
  height: bigint;
}

export interface LwdSendResponse {
  errorCode: number;
  errorMessage: string;
}

export interface LightwalletdGrpcClientOptions {
  /// Base URL of the lightwalletd endpoint, e.g.
  /// `"https://zec.rocks:443"`, `"https://mainnet.lightwalletd.com:9067"`.
  /// MUST be a full origin (scheme + host + port) — `node:http2.connect`
  /// requires it.
  baseUrl: string;
  timeoutMs?: number;
}

/// Binary gRPC client for lightwalletd. Node-only. Use this against
/// public mainnet/testnet lightwalletd endpoints; use the JSON
/// `LightwalletdClient` against a `tonic-web`-enabled local stack.
export class LightwalletdGrpcClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(opts: LightwalletdGrpcClientOptions) {
    if (!opts || typeof opts.baseUrl !== "string" || opts.baseUrl.length === 0) {
      throw new Error("LightwalletdGrpcClient: { baseUrl } is required");
    }
    this.baseUrl = opts.baseUrl;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
  }

  async getLightdInfo(): Promise<LightdInfoGrpc> {
    const body = await call(this.baseUrl, "GetLightdInfo", new Uint8Array(), this.timeoutMs);
    const r = new Reader(body);
    let version = "";
    let chainName = "";
    let consensusBranchIdHex = "";
    let saplingActivationHeight = 0n;
    let blockHeight = 0n;
    while (!r.eof()) {
      const tag = Number(r.varint());
      const field = tag >>> 3;
      const wt = tag & 0x7;
      switch (field) {
        case 1:
          version = new TextDecoder().decode(r.bytes());
          break;
        case 4:
          chainName = new TextDecoder().decode(r.bytes());
          break;
        case 5:
          saplingActivationHeight = r.varint();
          break;
        case 6:
          consensusBranchIdHex = new TextDecoder().decode(r.bytes());
          break;
        case 7:
          blockHeight = r.varint();
          break;
        default:
          r.skip(wt as WireType);
      }
    }
    const consensusBranchId = parseInt(consensusBranchIdHex, 16) >>> 0;
    return { version, chainName, consensusBranchId, saplingActivationHeight, blockHeight };
  }

  async getAddressUtxos(
    addresses: string[],
    opts?: { startHeight?: bigint; maxEntries?: number },
  ): Promise<UtxoEntryGrpc[]> {
    const parts: Uint8Array[] = [];
    for (const a of addresses) parts.push(encodeString(1, a));
    if (opts?.startHeight && opts.startHeight > 0n) parts.push(encodeUint64(2, opts.startHeight));
    if (opts?.maxEntries && opts.maxEntries > 0) parts.push(encodeUint32(3, opts.maxEntries));
    const reqBody = concat(parts);

    const body = await call(this.baseUrl, "GetAddressUtxos", reqBody, this.timeoutMs);
    const r = new Reader(body);
    const out: UtxoEntryGrpc[] = [];
    while (!r.eof()) {
      const tag = Number(r.varint());
      const field = tag >>> 3;
      const wt = tag & 0x7;
      if (field === 1 && wt === WireType.LEN) {
        const inner = new Reader(r.bytes());
        let address = "";
        let txid = new Uint8Array();
        let index = 0;
        let script = new Uint8Array();
        let valueZat = 0n;
        let height = 0n;
        while (!inner.eof()) {
          const itag = Number(inner.varint());
          const ifield = itag >>> 3;
          const iwt = itag & 0x7;
          switch (ifield) {
            case 6:
              address = new TextDecoder().decode(inner.bytes());
              break;
            case 1:
              txid = new Uint8Array(inner.bytes());
              break;
            case 2:
              index = Number(inner.varint());
              break;
            case 3:
              script = new Uint8Array(inner.bytes());
              break;
            case 4:
              valueZat = inner.varint();
              break;
            case 5:
              height = inner.varint();
              break;
            default:
              inner.skip(iwt as WireType);
          }
        }
        out.push({ address, txid, index, scriptPubkey: script, valueZat, height });
      } else {
        r.skip(wt as WireType);
      }
    }
    return out;
  }

  /// Submit a raw v5 transaction. `data` = raw bytes; `height` left as
  /// the proto3 default 0 (mempool sentinel).
  async sendTransaction(rawTx: Uint8Array): Promise<LwdSendResponse> {
    const reqBody = encodeBytes(1, rawTx);
    const body = await call(this.baseUrl, "SendTransaction", reqBody, this.timeoutMs);
    const r = new Reader(body);
    let errorCode = 0;
    let errorMessage = "";
    while (!r.eof()) {
      const tag = Number(r.varint());
      const field = tag >>> 3;
      const wt = tag & 0x7;
      switch (field) {
        case 1:
          errorCode = Number(r.varint());
          break;
        case 2:
          errorMessage = new TextDecoder().decode(r.bytes());
          break;
        default:
          r.skip(wt as WireType);
      }
    }
    return { errorCode, errorMessage };
  }
}
