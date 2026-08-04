import { describe, it, expect, vi, beforeEach } from "vitest";
import { promisify } from "node:util";

vi.mock("node:child_process", async () => {
  const { promisify: realPromisify } = await import("node:util");
  const fn: any = vi.fn();
  const promisified = vi.fn();
  fn[realPromisify.custom] = promisified;
  return { execFile: fn };
});

import { execFile } from "node:child_process";
import { detectHimalayaVersion } from "../src/himalaya/cli-version";
import { HimalayaError } from "../src/himalaya/errors";

const mockExecFileAsync = (execFile as any)[promisify.custom] as ReturnType<typeof vi.fn>;

describe("detectHimalayaVersion", () => {
  beforeEach(() => {
    mockExecFileAsync.mockReset();
  });

  it("parses the major version from real v2.0.0 --version output", async () => {
    mockExecFileAsync.mockResolvedValue({
      stdout: "himalaya v2.0.0 +gmail +jmap +msgraph +smtp +rustls-ring +imap +m2dir\n",
      stderr: "",
    });

    const result = await detectHimalayaVersion("himalaya");
    expect(result.major).toBe(2);
    expect(result.raw).toContain("v2.0.0");
    expect(mockExecFileAsync).toHaveBeenCalledWith("himalaya", ["--version"], { timeout: 5_000 });
  });

  it("parses a plausible v1.x --version output", async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: "himalaya 1.1.0\n", stderr: "" });
    const result = await detectHimalayaVersion("himalaya");
    expect(result.major).toBe(1);
  });

  it("throws himalaya_version_undetected on empty stdout", async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: "", stderr: "" });
    try {
      await detectHimalayaVersion("himalaya");
      throw new Error("expected to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(HimalayaError);
      expect((e as HimalayaError).envelope.code).toBe("himalaya_version_undetected");
    }
  });

  it("throws himalaya_version_undetected on unparseable stdout (no version prefix)", async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: "himalaya (git rev unknown)\n", stderr: "" });
    try {
      await detectHimalayaVersion("himalaya");
      throw new Error("expected to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(HimalayaError);
      expect((e as HimalayaError).envelope.code).toBe("himalaya_version_undetected");
    }
  });

  it("throws himalaya_version_undetected when the probe times out", async () => {
    const err: any = new Error("Command timed out");
    err.killed = true;
    err.signal = "SIGTERM";
    mockExecFileAsync.mockRejectedValue(err);

    try {
      await detectHimalayaVersion("himalaya");
      throw new Error("expected to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(HimalayaError);
      expect((e as HimalayaError).envelope.code).toBe("himalaya_version_undetected");
      expect((e as HimalayaError).envelope.recoverable).toBe(false);
    }
  });

  it("throws himalaya_version_undetected when the binary is missing (ENOENT)", async () => {
    const err: any = new Error("spawn himalaya ENOENT");
    err.code = "ENOENT";
    mockExecFileAsync.mockRejectedValue(err);

    try {
      await detectHimalayaVersion("himalaya");
      throw new Error("expected to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(HimalayaError);
      expect((e as HimalayaError).envelope.code).toBe("himalaya_version_undetected");
    }
  });

  it("uses its own 5s timeout, independent of any command timeout", async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: "himalaya v2.0.0\n", stderr: "" });
    await detectHimalayaVersion("himalaya");
    const callArgs = mockExecFileAsync.mock.calls[0];
    expect(callArgs[2]).toEqual({ timeout: 5_000 });
  });
});
