// Status polling for any tenant's SigningRequest.

import { Connection, PublicKey } from "@solana/web3.js";
import {
  decodeSigningRequest,
  RequestStatus,
  SDKError,
  SIGNING_REQUEST_DISCRIMINATOR,
  type SigningRequest,
  type SignatureFormat,
} from "@causeway-sh/core";

export type TenantRequestStatus =
  | { status: "pending" }
  | { status: "expired" }
  | { status: "failed" }
  | { status: "completed"; signatureBlob: Uint8Array; signatureLen: number; signatureFormat: SignatureFormat };

export async function getSigningRequestStatus(
  connection: Connection,
  requestPda: PublicKey,
): Promise<TenantRequestStatus> {
  const info = await connection.getAccountInfo(requestPda, "confirmed");
  if (!info) return { status: "pending" }; // not yet on-chain
  const data = info.data;
  if (data.length < 8 || !discMatches(data, SIGNING_REQUEST_DISCRIMINATOR)) {
    throw new SDKError("account_decode_failed", "account at requestPda is not a SigningRequest");
  }
  const decoded: SigningRequest = decodeSigningRequest(data);
  switch (decoded.status) {
    case RequestStatus.Pending: {
      // Could still expire — caller can compare deadlineSlot vs current
      // slot. We report pending here; the explicit `expired` only
      // surfaces after `expire_request` has been submitted.
      return { status: "pending" };
    }
    case RequestStatus.Failed:
      return { status: "failed" };
    case RequestStatus.Completed: {
      const cs = decoded.completedSignature;
      if (!cs) {
        throw new SDKError(
          "account_decode_failed",
          "SigningRequest.status == Completed but completedSignature is missing",
        );
      }
      return {
        status: "completed",
        signatureBlob: cs.signatureBlob.slice(0, cs.signatureLen),
        signatureLen: cs.signatureLen,
        signatureFormat: cs.signatureFormat,
      };
    }
    default:
      throw new SDKError(
        "account_decode_failed",
        `unexpected RequestStatus discriminant: ${decoded.status}`,
      );
  }
}

function discMatches(data: Uint8Array, expected: Uint8Array): boolean {
  if (data.length < 8 || expected.length !== 8) return false;
  for (let i = 0; i < 8; i++) if (data[i] !== expected[i]) return false;
  return true;
}

export interface WaitForCompletionOptions {
  /// Max time to poll, in ms. Default 30s.
  timeoutMs?: number;
  /// Polling interval, in ms. Default 1500.
  intervalMs?: number;
}

export async function waitForCompletion(
  connection: Connection,
  requestPda: PublicKey,
  opts?: WaitForCompletionOptions,
): Promise<Extract<TenantRequestStatus, { status: "completed" }>> {
  const timeoutMs = opts?.timeoutMs ?? 30_000;
  const intervalMs = opts?.intervalMs ?? 1500;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const s = await getSigningRequestStatus(connection, requestPda);
    if (s.status === "completed") return s;
    if (s.status === "failed" || s.status === "expired") {
      throw new SDKError(
        "coordinator_rejected",
        `signing request transitioned to terminal status: ${s.status}`,
      );
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new SDKError(
    "transport_error",
    `waitForCompletion timed out after ${timeoutMs}ms`,
  );
}
