import { describe, it, expect, vi, beforeEach } from "vitest";
import { promisify } from "node:util";
import { HimalayaClient } from "../src/himalaya/client.js";
import { HimalayaError } from "../src/himalaya/errors.js";

// Mock node:child_process - preserve util.promisify.custom so
// promisify(execFile) returns {stdout, stderr}.
vi.mock("node:child_process", async () => {
  const { promisify: realPromisify } = await import("node:util");
  const fn: any = vi.fn();
  const promisified = vi.fn();
  fn[realPromisify.custom] = promisified;
  return { execFile: fn };
});

import { execFile } from "node:child_process";

const mockExecFileAsync = (execFile as any)[promisify.custom] as ReturnType<typeof vi.fn>;

const VERSION_STDOUT = { stdout: "himalaya v2.0.0 +gmail +imap", stderr: "" };

describe("client retry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecFileAsync.mockReset();
  });

  it("retries once on transient stderr and succeeds", async () => {
    mockExecFileAsync
      .mockResolvedValueOnce(VERSION_STDOUT)
      .mockRejectedValueOnce(
        Object.assign(new Error("exited 1"), { stderr: "ECONNRESET" }),
      )
      .mockResolvedValueOnce({ stdout: '{"ok": true}', stderr: "" });

    const client = new HimalayaClient({ account: "unm", retryBackoffMs: 0 });
    const result = await client.exec(["envelope", "list"]);

    expect(mockExecFileAsync).toHaveBeenCalledTimes(3);
    expect(result).toContain("ok");
  });

  it("does NOT retry on imap_auth_failed", async () => {
    mockExecFileAsync
      .mockResolvedValueOnce(VERSION_STDOUT)
      .mockRejectedValue(
        Object.assign(new Error("exited 1"), { stderr: "AUTHENTICATIONFAILED for user@example.com" }),
      );

    const client = new HimalayaClient({ account: "unm", retryBackoffMs: 0 });
    try {
      await client.exec(["envelope", "list"]);
      throw new Error("expected to throw");
    } catch (err) {
      if (!(err instanceof HimalayaError)) throw err;
      expect(mockExecFileAsync).toHaveBeenCalledTimes(2);
      expect(err.envelope.code).toBe("imap_auth_failed");
    }
  });

  it("surfaces transient failure with attempts: 2 when retry also fails", async () => {
    mockExecFileAsync
      .mockResolvedValueOnce(VERSION_STDOUT)
      .mockRejectedValue(
        Object.assign(new Error("exited 1"), { stderr: "ECONNRESET" }),
      );

    const client = new HimalayaClient({ account: "unm", retryBackoffMs: 0 });
    try {
      await client.exec(["envelope", "list"]);
      throw new Error("expected to throw");
    } catch (err) {
      if (!(err instanceof HimalayaError)) throw err;
      expect(mockExecFileAsync).toHaveBeenCalledTimes(3);
      expect(err.envelope.code).toBe("transient");
      expect(err.envelope.attempts).toBe(2);
    }
  });

  it("does NOT retry on imap_timeout (killed process)", async () => {
    mockExecFileAsync
      .mockResolvedValueOnce(VERSION_STDOUT)
      .mockRejectedValue(
        Object.assign(new Error("killed"), { killed: true }),
      );

    const client = new HimalayaClient({ account: "unm", retryBackoffMs: 0 });
    try {
      await client.exec(["envelope", "list"]);
      throw new Error("expected to throw");
    } catch (err) {
      if (!(err instanceof HimalayaError)) throw err;
      expect(mockExecFileAsync).toHaveBeenCalledTimes(2);
      expect(err.envelope.code).toBe("imap_timeout");
    }
  });
});
