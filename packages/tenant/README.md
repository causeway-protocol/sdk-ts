# @causeway-sh/tenant

Generic tenant-program helpers — parameterised by `tenantProgramId`.

## What's exposed

- `findTenantAuthority(cfg, asset, pathHash)` — derive the tenant
  authority PDA under the configured tenant program.
- `findTenantRequestPda(...)` — re-export of `@causeway-sh/core`'s
  signing-request PDA derivation.
- `getSigningRequestStatus(connection, requestPda)` — read the
  on-chain `SigningRequest` and report its lifecycle status.
- `waitForCompletion(connection, requestPda, opts?)` — poll until a
  signing request is completed (or times out).

## What's NOT exposed

Tenant-program *instruction builders* (e.g. `initiate_*_send`) are
specific to each tenant's Solana program ABI. Each tenant deploys its
own SDK alongside its program. `@causeway-sh/tenant` only carries the
cross-tenant shape.

## Status

Alpha. Not for real funds.
