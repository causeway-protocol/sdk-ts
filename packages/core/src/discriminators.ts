// Anchor 8-byte instruction discriminators for the Causeway program.
// Computed as `sha256("global:<ix_name>")[..8]` per Anchor 0.30 ABI.
// Mirrors `causeway-cpi`'s constants (sdk-rs).

export const INITIALIZE_PROTOCOL_CONFIG_DISC = new Uint8Array([28, 50, 43, 233, 244, 98, 123, 118]);
export const INITIALIZE_VAULT_DISC          = new Uint8Array([48, 191, 163, 44, 71, 129, 63, 164]);
export const REQUEST_SIGNING_DISC           = new Uint8Array([15, 21, 66, 210, 108, 31, 199, 71]);
export const COMPLETE_SIGNING_DISC          = new Uint8Array([254, 72, 144, 138, 212, 24, 153, 226]);
export const EXPIRE_REQUEST_DISC            = new Uint8Array([219, 189, 105, 97, 227, 47, 124, 23]);
export const PAUSE_VAULT_DISC               = new Uint8Array([250, 6, 228, 57, 6, 104, 19, 210]);
export const UNPAUSE_VAULT_DISC             = new Uint8Array([125, 29, 213, 213, 114, 155, 125, 63]);
export const BEGIN_ROTATION_DISC            = new Uint8Array([87, 32, 205, 53, 207, 148, 58, 139]);
export const FINALIZE_ROTATION_DISC         = new Uint8Array([237, 101, 3, 4, 60, 70, 61, 82]);
