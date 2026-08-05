/**
 * Unit tests for assessVersionDrift — version-staleness detection in `himalaya-mcp doctor`.
 *
 * Pattern mirrors tests/get-version.test.ts: mock node:fs at module level so the pure
 * function is exercised without touching the real ~/.claude or Homebrew layout.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { existsSyncMock, readFileSyncMock, lstatSyncMock, rmSyncMock, symlinkSyncMock } = vi.hoisted(() => ({
  existsSyncMock: vi.fn(),
  readFileSyncMock: vi.fn(),
  lstatSyncMock: vi.fn(),
  rmSyncMock: vi.fn(),
  symlinkSyncMock: vi.fn(),
}));

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    existsSync: (...args: Parameters<typeof actual.existsSync>) => existsSyncMock(...args),
    readFileSync: (...args: Parameters<typeof actual.readFileSync>) => readFileSyncMock(...args),
    lstatSync: (...args: Parameters<typeof actual.lstatSync>) => lstatSyncMock(...args),
    rmSync: (...args: Parameters<typeof actual.rmSync>) => rmSyncMock(...args),
    symlinkSync: (...args: Parameters<typeof actual.symlinkSync>) => symlinkSyncMock(...args),
  };
});

import { assessVersionDrift } from "../src/cli/doctor";

function baseOpts(overrides: Record<string, unknown> = {}) {
  return {
    binaryVersion: "2.0.3",
    pluginDir: "/home/user/.claude/plugins/himalaya-mcp",
    pluginJsonPath: "/home/user/.claude/plugins/himalaya-mcp/.claude-plugin/plugin.json",
    sourceDir: "/home/user/.claude/local-marketplace/himalaya-mcp",
    sourceJsonPath: "/home/user/.claude/local-marketplace/himalaya-mcp/.claude-plugin/marketplace.json",
    brewLibexecPath: "/opt/homebrew/opt/himalaya-mcp/libexec",
    ...overrides,
  };
}

describe("assessVersionDrift", () => {
  beforeEach(() => {
    existsSyncMock.mockReset();
    readFileSyncMock.mockReset();
    lstatSyncMock.mockReset();
    rmSyncMock.mockReset();
    symlinkSyncMock.mockReset();
  });

  it("passes when installed plugin version matches the binary and the source is a symlink", () => {
    existsSyncMock.mockImplementation((p: string) => p.includes("himalaya-mcp") || p.includes(".claude-plugin"));
    readFileSyncMock.mockImplementation((p: string) => JSON.stringify({ version: "2.0.3" }));
    lstatSyncMock.mockImplementation(() => ({ isSymbolicLink: () => true }));

    const results = assessVersionDrift(baseOpts());
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ name: "Plugin version", status: "pass", message: "v2.0.3 matches binary" });
    expect(results[1]).toMatchObject({ name: "Marketplace source version", status: "pass" });
  });

  it("warns when installed plugin version differs from the binary and attaches a relink fix", () => {
    existsSyncMock.mockImplementation((p: string) => p.includes("himalaya-mcp") || p.includes(".claude-plugin"));
    readFileSyncMock.mockImplementation((p: string) => JSON.stringify({ version: "2.0.2" }));
    lstatSyncMock.mockImplementation(() => ({ isSymbolicLink: () => true }));

    const results = assessVersionDrift(baseOpts());
    expect(results).toHaveLength(2);
    const plugin = results[0];
    expect(plugin.status).toBe("warn");
    expect(plugin.message).toContain("Installed plugin v2.0.2 ≠ binary v2.0.3");
    expect(plugin.fix).toBeDefined();
    expect(plugin.fix!.description).toContain("Relink");
    plugin.fix!.auto!();
    expect(rmSyncMock).toHaveBeenCalledWith("/home/user/.claude/plugins/himalaya-mcp", { recursive: true, force: true });
    expect(symlinkSyncMock).toHaveBeenCalledWith("/opt/homebrew/opt/himalaya-mcp/libexec", "/home/user/.claude/plugins/himalaya-mcp", "dir");
  });

  it("warns that a directory copy is not a symlink even when versions match", () => {
    existsSyncMock.mockImplementation((p: string) => p.includes("himalaya-mcp") || p.includes(".claude-plugin"));
    readFileSyncMock.mockImplementation((p: string) => JSON.stringify({ version: "2.0.3" }));
    lstatSyncMock.mockImplementation(() => ({ isSymbolicLink: () => false }));

    const results = assessVersionDrift(baseOpts());
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ status: "pass" });
    const source = results[1];
    expect(source.status).toBe("warn");
    expect(source.message).toContain("a copy, not a symlink");
  });

  it("warns when the marketplace source version is stale", () => {
    existsSyncMock.mockImplementation((p: string) => p.includes("himalaya-mcp") || p.includes(".claude-plugin"));
    readFileSyncMock.mockImplementation((p: string) =>
      p.endsWith(".claude-plugin/plugin.json") ? JSON.stringify({ version: "2.0.3" }) : JSON.stringify({ version: "2.0.2" }),
    );
    lstatSyncMock.mockImplementation(() => ({ isSymbolicLink: () => false }));

    const results = assessVersionDrift(baseOpts());
    const source = results[1];
    expect(source.status).toBe("warn");
    expect(source.message).toContain("local-marketplace source v2.0.2 ≠ binary v2.0.3");
  });

  it("does not attach a fix when no Homebrew libexec is available", () => {
    existsSyncMock.mockImplementation((p: string) => p.includes("himalaya-mcp") || p.includes(".claude-plugin"));
    readFileSyncMock.mockImplementation((p: string) => JSON.stringify({ version: "2.0.2" }));
    lstatSyncMock.mockImplementation(() => ({ isSymbolicLink: () => false }));

    const results = assessVersionDrift(baseOpts({ brewLibexecPath: null }));
    expect(results).toHaveLength(2);
    expect(results[0].fix).toBeUndefined();
    expect(results[1].fix).toBeUndefined();
  });

  it("returns no checks when the binary version is unknown", () => {
    const results = assessVersionDrift(baseOpts({ binaryVersion: "" }));
    expect(results).toHaveLength(0);
  });

  it("skips the marketplace source check when the source dir is absent", () => {
    existsSyncMock.mockImplementation((p: string) => p.endsWith(".claude-plugin/plugin.json") && !p.includes("local-marketplace"));
    readFileSyncMock.mockImplementation((p: string) => JSON.stringify({ version: "2.0.3" }));

    const results = assessVersionDrift(baseOpts());
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ name: "Plugin version", status: "pass" });
  });

  it("warns (not fails) when a version file is unreadable", () => {
    existsSyncMock.mockImplementation((p: string) => p.includes("himalaya-mcp") || p.includes(".claude-plugin"));
    readFileSyncMock.mockImplementation(() => {
      throw new Error("EACCES");
    });
    lstatSyncMock.mockImplementation(() => ({ isSymbolicLink: () => true }));

    const results = assessVersionDrift(baseOpts());
    expect(results).toHaveLength(2);
    expect(results[0].status).toBe("warn");
    expect(results[0].message).toBe("Could not read installed plugin version");
    expect(results[1].status).toBe("warn");
    expect(results[1].message).toBe("Could not read local-marketplace source version");
  });
});
