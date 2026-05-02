// Bundle-size gate: each asset package must NOT pull in any other
// asset package. An EVM-only dApp installing `@causeway-sh/{core,evm}`
// must not transitively bundle ZEC or BTC code. Per-package
// `package.json::dependencies` is the source of truth — we read it
// and refuse cross-asset references.
//
// This is a static check; it runs in vitest because that's where the
// monorepo's CI lives. No bundler involved.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const sdkRoot = resolve(here, "..", "..");

interface PackageJson {
  name: string;
  dependencies?: Record<string, string>;
}

function readPkg(rel: string): PackageJson {
  return JSON.parse(readFileSync(resolve(sdkRoot, rel), "utf8")) as PackageJson;
}

const ASSET_NAMES = ["@causeway-sh/btc", "@causeway-sh/zec", "@causeway-sh/evm"] as const;

describe("bundle-size leak guard", () => {
  for (const assetPkg of ["packages/evm", "packages/zec", "packages/btc"]) {
    it(`${assetPkg} does not depend on any other asset package`, () => {
      const pkg = readPkg(`${assetPkg}/package.json`);
      const deps = Object.keys(pkg.dependencies ?? {});
      const otherAssets = ASSET_NAMES.filter((n) => n !== pkg.name);
      for (const a of otherAssets) {
        expect(
          deps,
          `${pkg.name} must not depend on ${a} — asset packages are independent`,
        ).not.toContain(a);
      }
    });
  }

  it("@causeway-sh/core has no asset deps", () => {
    const pkg = readPkg("packages/core/package.json");
    const deps = Object.keys(pkg.dependencies ?? {});
    for (const a of ASSET_NAMES) {
      expect(deps).not.toContain(a);
    }
  });

  it("@causeway-sh/tenant has no asset deps", () => {
    const pkg = readPkg("packages/tenant/package.json");
    const deps = Object.keys(pkg.dependencies ?? {});
    for (const a of ASSET_NAMES) {
      expect(deps).not.toContain(a);
    }
  });
});
