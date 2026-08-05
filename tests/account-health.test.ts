import { describe, it, expect, vi, beforeEach } from "vitest";
import { promisify } from "node:util";

// checkAccountHealth() calls whichBin() (execFileSync `which himalaya`),
// detectHimalayaVersion() (promisify(execFile) `himalaya --version`), then
// execFileSync(himalaya, <mailbox|folder> list --account <name> --json).
// Mocking node:child_process covers all three at the source of the
// subprocess calls, mirroring the check-prerequisites.test.ts pattern.
vi.mock("node:child_process", async () => {
  const { promisify: realPromisify } = await import("node:util");
  const fn: any = vi.fn();
  const promisified = vi.fn();
  fn[realPromisify.custom] = promisified;
  return { execFile: fn, execFileSync: vi.fn() };
});

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return { ...actual, existsSync: vi.fn().mockReturnValue(true) };
});

import { execFile, execFileSync } from "node:child_process";
import { checkAccountHealth } from "../src/cli/doctor";

const mockExecFileSync = vi.mocked(execFileSync);
const mockExecFileAsync = (execFile as any)[promisify.custom] as ReturnType<typeof vi.fn>;

describe("checkAccountHealth — dual v1/v2 CLI syntax", () => {
  const account = "unm";

  beforeEach(() => {
    vi.clearAllMocks();
    // `which himalaya` resolves to a fixed path; any other subprocess
    // (the folder/mailbox list) returns canned JSON.
    mockExecFileSync.mockImplementation((bin: string) =>
      Buffer.from(bin === "which" ? "/opt/homebrew/bin/himalaya\n" : "[]\n"),
    );
  });

  function listCall() {
    const call = mockExecFileSync.mock.calls.find((c) => c[0] !== "which");
    if (!call) throw new Error("no folder/mailbox list subprocess call found");
    return call;
  }

  it("uses v2 mailbox/--json syntax when --version reports v2", async () => {
    mockExecFileAsync.mockResolvedValue({
      stdout: "himalaya v2.0.0 +gmail +jmap +msgraph +smtp +rustls-ring +imap +m2dir\n",
      stderr: "",
    });

    const result = await checkAccountHealth(account);
    expect(result.reachable).toBe(true);
    expect(listCall()[1]).toEqual(["mailbox", "list", "--account", account, "--json"]);
  });

  it("uses v1 folder/--output json syntax when --version reports v1", async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: "himalaya 1.1.0\n", stderr: "" });

    const result = await checkAccountHealth(account);
    expect(result.reachable).toBe(true);
    expect(listCall()[1]).toEqual(["folder", "list", "--account", account, "--output", "json"]);
  });

  it("falls back to v2 syntax when version detection fails", async () => {
    mockExecFileAsync.mockRejectedValue(
      Object.assign(new Error("Command timed out"), { killed: true }),
    );

    const result = await checkAccountHealth(account);
    expect(result.reachable).toBe(true);
    expect(listCall()[1]).toEqual(["mailbox", "list", "--account", account, "--json"]);
  });

  it("reports unreachable when the list subprocess fails", async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: "himalaya v2.0.0\n", stderr: "" });
    mockExecFileSync.mockImplementation((bin: string) => {
      if (bin === "which") return Buffer.from("/opt/homebrew/bin/himalaya\n");
      throw new Error("Command failed: unrecognized subcommand 'folder'");
    });

    const result = await checkAccountHealth(account);
    expect(result.reachable).toBe(false);
    expect(result.error).toContain("unrecognized subcommand");
  });

  it("reports not-found without probing version when himalaya is missing from PATH", async () => {
    mockExecFileSync.mockReturnValue(Buffer.from("\n"));

    const result = await checkAccountHealth(account);
    expect(result.reachable).toBe(false);
    expect(result.error).toContain("himalaya CLI not found on PATH");
    expect(mockExecFileAsync).not.toHaveBeenCalled();
  });

  it("passes a 15s timeout to the list subprocess (matches the #126 probe rationale)", async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: "himalaya v2.0.0\n", stderr: "" });

    await checkAccountHealth(account);
    expect(listCall()[2]).toMatchObject({ timeout: 15_000 });
  });
});
