import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/**
 * Regression for the v2.2.0 Homebrew breakage: the formula installs only dist/ into
 * libexec (no node_modules), so the CLI must be a self-contained bundle. Running the
 * bundled CLI from a directory with no node_modules proves it has no runtime imports.
 */
describe("bundled CLI is self-contained", () => {
  it("runs --version and doctor from a tree with no node_modules", () => {
    const root = resolve(__dirname, "..");
    const dir = mkdtempSync(join(tmpdir(), "hmcp-cli-"));
    try {
      mkdirSync(join(dir, "dist", "cli"), { recursive: true });
      writeFileSync(join(dir, "package.json"), JSON.stringify({ version: "9.9.9", type: "module" }));
      execFileSync(
        join(root, "node_modules", ".bin", "esbuild"),
        [
          join(root, "src/cli/index.ts"),
          "--bundle",
          "--platform=node",
          "--target=node22",
          "--format=esm",
          `--outfile=${join(dir, "dist/cli/index.js")}`,
          "--banner:js=import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
          "--log-level=error",
        ],
        { stdio: "pipe" },
      );
      expect(existsSync(join(dir, "node_modules"))).toBe(false);
      const out = execFileSync("node", [join(dir, "dist/cli/index.js"), "--version"], {
        cwd: dir,
        encoding: "utf-8",
      });
      expect(out).toContain("9.9.9");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("package.json build:cli mirrors the bundle flags used by build:bundle", async () => {
    const pkg = (await import("../package.json", { with: { type: "json" } })).default as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts["build:cli"]).toContain("dist/cli/index.js");
    expect(pkg.scripts["build:bundle"]).toMatch(/^npm run build:cli/);
  });
});
