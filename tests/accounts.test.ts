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
import { listAccounts, getDefaultAccount, isImapAccount } from "../src/himalaya/accounts";
import { HimalayaError } from "../src/himalaya/errors";

const mockExecFileAsync = (execFile as any)[promisify.custom] as ReturnType<typeof vi.fn>;

describe("accounts", () => {
  beforeEach(() => {
    mockExecFileAsync.mockReset();
  });

  it("listAccounts returns parsed account names from himalaya CLI", async () => {
    mockExecFileAsync.mockResolvedValue({
      stdout: JSON.stringify({
        accounts: [
          { name: "unm", default: true, backends: ["imap", "smtp"] },
          { name: "personal", default: false, backends: ["imap"] },
        ],
      }),
      stderr: "",
    });

    const accounts = await listAccounts();
    expect(mockExecFileAsync).toHaveBeenCalledWith("himalaya", ["account", "list", "--json"], { timeout: 15_000 });
    expect(accounts).toEqual([
      { name: "unm", isDefault: true, backends: ["imap", "smtp"] },
      { name: "personal", isDefault: false, backends: ["imap"] },
    ]);
  });

  it("listAccounts accepts legacy bare-array JSON output with singular `backend`", async () => {
    mockExecFileAsync.mockResolvedValue({
      stdout: JSON.stringify([
        { name: "unm", default: true, backend: "imap" },
      ]),
      stderr: "",
    });

    expect(await listAccounts()).toEqual([{ name: "unm", isDefault: true, backends: ["imap"] }]);
  });

  it("listAccounts leaves backends undefined when neither backend nor backends is present", async () => {
    mockExecFileAsync.mockResolvedValue({
      stdout: JSON.stringify([{ name: "unm", default: true }]),
      stderr: "",
    });

    expect(await listAccounts()).toEqual([{ name: "unm", isDefault: true, backends: undefined }]);
  });

  it("listAccounts leaves backends undefined for an empty backends array", async () => {
    mockExecFileAsync.mockResolvedValue({
      stdout: JSON.stringify([{ name: "unm", default: true, backends: [] }]),
      stderr: "",
    });

    expect(await listAccounts()).toEqual([{ name: "unm", isDefault: true, backends: undefined }]);
  });

  it("listAccounts returns empty array when himalaya has no configured accounts", async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: "[]", stderr: "" });
    expect(await listAccounts()).toEqual([]);
  });

  it("listAccounts throws HimalayaError(himalaya_not_installed) on ENOENT", async () => {
    const err: any = new Error("spawn himalaya ENOENT");
    err.code = "ENOENT";
    mockExecFileAsync.mockRejectedValue(err);

    try {
      await listAccounts();
      throw new Error("expected to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(HimalayaError);
      expect((e as HimalayaError).envelope.code).toBe("himalaya_not_installed");
    }
  });

  it("getDefaultAccount returns the account marked default", async () => {
    mockExecFileAsync.mockResolvedValue({
      stdout: JSON.stringify({
        accounts: [
          { name: "unm", default: false, backends: ["imap"] },
          { name: "personal", default: true, backends: ["imap"] },
        ],
      }),
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

  it("listAccounts throws HimalayaError(parse_error) on malformed JSON", async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: "not json", stderr: "" });
    try {
      await listAccounts();
      throw new Error("expected to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(HimalayaError);
      expect((e as HimalayaError).envelope.code).toBe("parse_error");
    }
  });
});

describe("isImapAccount (fail-closed)", () => {
  it("returns true when backends includes imap", () => {
    expect(isImapAccount({ backends: ["imap", "smtp"] })).toBe(true);
  });

  it("returns false when backends is missing", () => {
    expect(isImapAccount({ backends: undefined })).toBe(false);
  });

  it("returns false when backends is empty", () => {
    expect(isImapAccount({ backends: [] })).toBe(false);
  });

  it("returns false when backends contains only non-imap entries", () => {
    expect(isImapAccount({ backends: ["jmap", "smtp"] })).toBe(false);
  });
});
