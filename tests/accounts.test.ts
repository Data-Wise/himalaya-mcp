import { describe, it, expect, vi, beforeEach } from "vitest";
import { promisify } from "node:util";

// Mock node:child_process — accounts.ts uses promisify(execFile),
// so we must preserve the promisify.custom symbol that wraps it.
vi.mock("node:child_process", async () => {
  const { promisify: realPromisify } = await import("node:util");
  const fn: any = vi.fn();
  const promisified = vi.fn();
  fn[realPromisify.custom] = promisified;
  return { execFile: fn };
});

import { execFile } from "node:child_process";
import { listAccounts, getDefaultAccount } from "../src/himalaya/accounts";

const mockExecFileAsync = (execFile as any)[promisify.custom] as ReturnType<typeof vi.fn>;

describe("accounts", () => {
  beforeEach(() => {
    mockExecFileAsync.mockReset();
  });

  it("listAccounts returns parsed account names from himalaya CLI", async () => {
    mockExecFileAsync.mockResolvedValue({
      stdout: JSON.stringify([
        { name: "unm", default: true, backend: "imap" },
        { name: "personal", default: false, backend: "imap" },
      ]),
      stderr: "",
    });

    const accounts = await listAccounts();
    expect(accounts).toEqual([
      { name: "unm", isDefault: true },
      { name: "personal", isDefault: false },
    ]);
  });

  it("listAccounts returns empty array when himalaya has no configured accounts", async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: "[]", stderr: "" });
    expect(await listAccounts()).toEqual([]);
  });

  it("listAccounts throws when himalaya CLI is not installed", async () => {
    const err: any = new Error("spawn himalaya ENOENT");
    err.code = "ENOENT";
    mockExecFileAsync.mockRejectedValue(err);

    await expect(listAccounts()).rejects.toThrow(/not installed|ENOENT/);
  });

  it("getDefaultAccount returns the account marked default", async () => {
    mockExecFileAsync.mockResolvedValue({
      stdout: JSON.stringify([
        { name: "unm", default: false, backend: "imap" },
        { name: "personal", default: true, backend: "imap" },
      ]),
      stderr: "",
    });

    expect(await getDefaultAccount()).toBe("personal");
  });

  it("getDefaultAccount returns null when no account is marked default", async () => {
    mockExecFileAsync.mockResolvedValue({
      stdout: JSON.stringify([{ name: "unm", default: false, backend: "imap" }]),
      stderr: "",
    });

    expect(await getDefaultAccount()).toBeNull();
  });

  it("listAccounts handles malformed JSON gracefully", async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: "not json", stderr: "" });
    await expect(listAccounts()).rejects.toThrow(/parse/i);
  });
});
