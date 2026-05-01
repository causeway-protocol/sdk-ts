// Typed errors with discriminated `kind` field. All public APIs
// throw `SDKError` (or a subclass) — never raw strings, never raw
// `Error`s. Consumers can switch on `e.kind` and handle each branch.

export type SDKErrorKind =
  | "invalid_args"
  | "pda_derivation_failed"
  | "account_decode_failed"
  | "coordinator_unreachable"
  | "coordinator_rejected"
  | "transport_error";

export class SDKError extends Error {
  readonly name = "SDKError";
  constructor(
    public readonly kind: SDKErrorKind,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
  }
}

export function isSDKError(e: unknown): e is SDKError {
  return e instanceof SDKError;
}
