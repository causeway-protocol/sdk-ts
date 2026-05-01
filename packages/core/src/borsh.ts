// Tiny streaming Borsh reader. Not a full implementation — just the
// subset @causeway-sh/core uses to decode SigningRequest + Vault +
// ProtocolConfig. Avoids a heavy `@coral-xyz/anchor` dep at runtime.

export class BorshReader {
  private offset = 0;
  constructor(private readonly view: DataView, private readonly bytes: Uint8Array) {}

  static from(data: Uint8Array): BorshReader {
    return new BorshReader(new DataView(data.buffer, data.byteOffset, data.byteLength), data);
  }

  remaining(): number {
    return this.bytes.length - this.offset;
  }

  u8(): number {
    if (this.remaining() < 1) throw new Error("borsh: unexpected EOF reading u8");
    return this.bytes[this.offset++]!;
  }

  bool(): boolean {
    return this.u8() !== 0;
  }

  u32(): number {
    if (this.remaining() < 4) throw new Error("borsh: unexpected EOF reading u32");
    const v = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return v;
  }

  u64(): bigint {
    if (this.remaining() < 8) throw new Error("borsh: unexpected EOF reading u64");
    const v = this.view.getBigUint64(this.offset, true);
    this.offset += 8;
    return v;
  }

  i64(): bigint {
    if (this.remaining() < 8) throw new Error("borsh: unexpected EOF reading i64");
    const v = this.view.getBigInt64(this.offset, true);
    this.offset += 8;
    return v;
  }

  fixedBytes(n: number): Uint8Array {
    if (this.remaining() < n)
      throw new Error(`borsh: unexpected EOF reading ${n} bytes`);
    const out = this.bytes.slice(this.offset, this.offset + n);
    this.offset += n;
    return out;
  }

  optionFixedBytes(n: number): Uint8Array | null {
    return this.bool() ? this.fixedBytes(n) : null;
  }

  optionU64(): bigint | null {
    return this.bool() ? this.u64() : null;
  }

  /// Consume exactly the 8-byte Anchor discriminator. Caller must have
  /// already verified the discriminator matches the expected account
  /// type — this is a positional skip.
  skipDiscriminator(): void {
    this.fixedBytes(8);
  }
}
