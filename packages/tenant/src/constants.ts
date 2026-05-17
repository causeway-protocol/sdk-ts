import { PublicKey } from "@solana/web3.js";

/// Program ID of the **reference tenant** deployed alongside Causeway.
/// Used by quickstarts and the SDK examples; production integrations
/// should deploy their own tenant program and override this in the
/// `buildInitiate*Send` builders.
export const REFERENCE_TENANT_PROGRAM_ID = new PublicKey(
  "8qbHbw2BbbTHBW1sbeqakYXVKRQM8Ne7pLK7m6CVfeR",
);

/// Seed prefix for the reference tenant's per-request PDA. Tenants that
/// follow the canonical Anchor account-set ship this same seed; tenants
/// that diverge ship their own helper.
export const REFERENCE_TENANT_REQUEST_SEED = new TextEncoder().encode(
  "tenant-demo:request:v1",
);
