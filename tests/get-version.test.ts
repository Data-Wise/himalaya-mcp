/**
 * Unit tests for src/cli/shared.ts's getVersion() fallback chain.
 *
 * Pure unit test — mocks node:fs so it never touches the real dist/ tree.
 * Replaces an earlier E2E version that spawned a subprocess against a copy
 * of dist/; that copy raced tests/e2e.test.ts's beforeAll (`npm run build`,
 * a full tsc rewrite of dist/) under vitest's default cross-file
 * parallelism (no fileParallelism: false in vitest.config.ts) and flaked
 * once in a full-suite Docker run. This version can't race anything: no
 * filesystem writes, no subprocess, no shared dist/ dependency.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const readFileSyncMock = vi.fn();

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    readFileSync: (...args: Parameters<typeof actual.readFileSync>) => readFileSyncMock(...args),
    // realpathSync resolves against a fake project root; identity is fine
    // here since getVersion() only uses it to derive projectRoot's location,
    // and Vitest already runs from a real, non-symlinked path in CI/Docker.
    realpathSync: actual.realpathSync,
  };
});

import { getVersion } from "../src/cli/shared";

describe("getVersion", () => {
  beforeEach(() => {
    readFileSyncMock.mockReset();
  });

  it("reads the version from package.json when present", () => {
    readFileSyncMock.mockImplementation((path: string) => {
      if (String(path).endsWith("package.json")) {
        return JSON.stringify({ version: "9.9.9" });
      }
      throw new Error(`unexpected readFileSync call: ${path}`);
    });

    expect(getVersion()).toBe("9.9.9");
  });

  it("falls back to marketplace.json when package.json is absent (Homebrew libexec layout)", () => {
    // Reproduces the Homebrew formula's install layout: dist/, .claude-plugin/,
    // agents/, man/, and skills/ get copied into libexec/, but package.json
    // never does -- so (1) always misses there and getVersion() must fall
    // through to marketplace.json's top-level "version" field.
    readFileSyncMock.mockImplementation((path: string) => {
      const p = String(path);
      if (p.endsWith("package.json")) {
        const err = new Error("ENOENT") as NodeJS.ErrnoException;
        err.code = "ENOENT";
        throw err;
      }
      if (p.endsWith("marketplace.json")) {
        return JSON.stringify({ name: "himalaya-mcp", version: "2.0.3" });
      }
      throw new Error(`unexpected readFileSync call: ${p}`);
    });

    expect(getVersion()).toBe("2.0.3");
    expect(getVersion()).not.toBe("unknown");
  });

  it("returns empty string when neither package.json nor marketplace.json resolve", () => {
    readFileSyncMock.mockImplementation(() => {
      const err = new Error("ENOENT") as NodeJS.ErrnoException;
      err.code = "ENOENT";
      throw err;
    });

    expect(getVersion()).toBe("");
  });
});
