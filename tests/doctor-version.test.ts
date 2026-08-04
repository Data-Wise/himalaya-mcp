import { describe, it, expect, vi, beforeEach } from "vitest";
import { promisify } from "node:util";

// checkPrerequisites() calls whichBin() (execFileSync, for `which himalaya`)
// and detectHimalayaVersion() (promisify(execFile), for `himalaya --version`).
// Both need mocking to test the version/branch reporting in isolation from
// the rest of doctor's filesystem-touching checks.
vi.mock("node:child_process", async () => {
  const { promisify: realPromisify } = await import("node:util");
  const fn: any = vi.fn();
  const promisified = vi.fn();
  fn[realPromisify.custom] = promisified;
  return { execFile: fn, execFileSync: vi.fn() };
});

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, existsSync: vi.fn().mockReturnValue(true) };
});

import { execFile, execFileSync } from "node:child_process";
import { checkPrerequisites } from "../src/cli/doctor";

const mockExecFileSync = vi.mocked(execFileSync);
const mockExecFileAsync = (execFile as any)[promisify.custom] as ReturnType<typeof vi.fn>;

describe("checkPrerequisites — himalaya CLI version/branch reporting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // `which himalaya` succeeds with a fixed path for every test in this file.
    mockExecFileSync.mockReturnValue(Buffer.from("/opt/homebrew/bin/himalaya\n"));
  });

  function himalayaCheck(results: Awaited<ReturnType<typeof checkPrerequisites>>) {
    const check = results.find((r) => r.name === "himalaya CLI");
    if (!check) throw new Error("no 'himalaya CLI' check result found");
    return check;
  }

  it("reports pass + v2/mailbox branch for a real v2.0.0 --version string", async () => {
    mockExecFileAsync.mockResolvedValue({
      stdout: "himalaya v2.0.0 +gmail +jmap +msgraph +smtp +rustls-ring +imap +m2dir\n",
      stderr: "",
    });

    const check = himalayaCheck(await checkPrerequisites());
    expect(check.status).toBe("pass");
    expect(check.message).toContain("v2.0.0");
    expect(check.message).toMatch(/v2 syntax/);
  });

  it("reports pass + v1/folder branch for a v1.x --version string", async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: "himalaya 1.1.0\n", stderr: "" });

    const check = himalayaCheck(await checkPrerequisites());
    expect(check.status).toBe("pass");
    expect(check.message).toMatch(/v1 syntax/);
  });

  it("reports fail (not a silent pass) when --version output is unparseable", async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: "himalaya (git rev unknown)\n", stderr: "" });

    const check = himalayaCheck(await checkPrerequisites());
    expect(check.status).toBe("fail");
    expect(check.message).toMatch(/Could not detect version/);
  });

  it("reports fail when the --version probe times out", async () => {
    const err: any = new Error("Command timed out");
    err.killed = true;
    mockExecFileAsync.mockRejectedValue(err);

    const check = himalayaCheck(await checkPrerequisites());
    expect(check.status).toBe("fail");
  });

  it("calls the --version probe exactly once per checkPrerequisites() run", async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: "himalaya v2.0.0\n", stderr: "" });
    await checkPrerequisites();
    expect(mockExecFileAsync).toHaveBeenCalledTimes(1);
  });
});
