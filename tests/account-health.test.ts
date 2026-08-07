import { describe, it, expect, vi, beforeEach } from "vitest";
import { promisify } from "node:util";

// checkAccountHealth() runs whichBin() (execFileSync `which himalaya`), then
// routes through HimalayaClient + probeAccountSurfaces: version probe
// (promisify(execFile) `himalaya --version`), then a folder-list probe and an
// envelope-list probe. Mocking node:child_process covers all of them at the
// source of the subprocess calls, mirroring the client.test.ts pattern.
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
import { checkAccountHealth, clearDoctorClientCache } from "../src/cli/doctor";

const mockExecFileSync = vi.mocked(execFileSync);
const mockExecFileAsync = (execFile as any)[promisify.custom] as ReturnType<typeof vi.fn>;

describe("checkAccountHealth — dual v1/v2 CLI syntax, multi-surface", () => {
  const account = "unm";

  beforeEach(() => {
    vi.clearAllMocks();
    // A fresh client per test: the cached HimalayaClient memoizes its
    // resolved himalaya version, which would leak v2 into the v1 test.
    clearDoctorClientCache();
    // `which himalaya` resolves to a fixed path.
    mockExecFileSync.mockImplementation((bin: string) =>
      Buffer.from(bin === "which" ? "/opt/homebrew/bin/himalaya\n" : "[]\n"),
    );
  });

  function asyncCallWithArgv(match: (argv: string[]) => boolean) {
    // promisify(execFile) calls land as (file, argv, options), so the argv
    // array is the second element of each recorded call.
    const call = mockExecFileAsync.mock.calls.find((c) => match(c[1]));
    if (!call) throw new Error("no matching async subprocess call found");
    return call;
  }
  const folderCall = () => asyncCallWithArgv((argv) => argv[0] === "mailbox" || argv[0] === "folder");
  const envelopeCall = () => asyncCallWithArgv((argv) => argv[0] === "envelope");

  it("uses v2 mailbox/--json syntax when --version reports v2", async () => {
    mockExecFileAsync.mockResolvedValue({
      stdout: "himalaya v2.0.0 +gmail +jmap +msgraph +smtp +rustls-ring +imap +m2dir\n",
      stderr: "",
    });

    const result = await checkAccountHealth(account);
    expect(result.reachable).toBe(true);
    expect(folderCall()[1]).toEqual(["mailbox", "list", "--account", account, "--json"]);
    expect(envelopeCall()[1]).toEqual(["envelope", "list", "--page-size", "1", "--account", account, "--json"]);
  });

  it("uses v1 folder/--output json syntax when --version reports v1", async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: "himalaya 1.1.0\n", stderr: "" });

    const result = await checkAccountHealth(account);
    expect(result.reachable).toBe(true);
    expect(folderCall()[1]).toEqual(["folder", "list", "--account", account, "--output", "json"]);
    expect(envelopeCall()[1]).toEqual(["envelope", "list", "--page-size", "1", "--account", account, "--output", "json"]);
  });

  it("reports unreachable (fail-closed) when version detection fails", async () => {
    // HimalayaClient.execOnce resolves the version first and throws
    // himalaya_version_undetected on failure -- no silent v2 fallback.
    mockExecFileAsync.mockRejectedValue(
      Object.assign(new Error("Command timed out"), { killed: true }),
    );

    const result = await checkAccountHealth(account);
    expect(result.reachable).toBe(false);
    expect(result.error).toMatch(/version/i);
  });

  it("reports unreachable when the folder-list subprocess fails", async () => {
    mockExecFileAsync
      .mockResolvedValueOnce({ stdout: "himalaya v2.0.0\n", stderr: "" })
      .mockRejectedValueOnce(new Error("Command failed: unrecognized subcommand 'folder'"))
      .mockResolvedValue({ stdout: "[]\n", stderr: "" });

    const result = await checkAccountHealth(account);
    expect(result.reachable).toBe(false);
    expect(result.error).toContain("unrecognized subcommand");
  });

  it("reports not-found without probing when himalaya is missing from PATH", async () => {
    mockExecFileSync.mockReturnValue(Buffer.from("\n"));

    const result = await checkAccountHealth(account);
    expect(result.reachable).toBe(false);
    expect(result.error).toContain("himalaya CLI not found on PATH");
    expect(mockExecFileAsync).not.toHaveBeenCalled();
  });

  it("passes a 15s timeout to the list subprocess", async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: "himalaya v2.0.0\n", stderr: "" });

    await checkAccountHealth(account);
    expect(folderCall()[2]).toMatchObject({ timeout: 15_000 });
  });
});
