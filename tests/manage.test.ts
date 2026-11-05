import { describe, it, expect, vi, beforeEach } from "vitest";
import { promisify } from "node:util";
import { HimalayaClient } from "../src/himalaya/client.js";

// Mock child_process (same pattern as client.test.ts)
vi.mock("node:child_process", async () => {
  const { promisify: realPromisify } = await import("node:util");
  const fn: any = vi.fn();
  const promisified = vi.fn();
  fn[realPromisify.custom] = promisified;
  return { execFile: fn };
});

import { execFile } from "node:child_process";

const mockExecFileAsync = (execFile as any)[promisify.custom] as ReturnType<typeof vi.fn>;

function setupMock(stdout: string, stderr = "") {
  mockExecFileAsync
    .mockResolvedValueOnce({ stdout: "himalaya v2.0.0 +gmail +imap", stderr: "" })
    .mockResolvedValue({ stdout, stderr });
}

describe("Manage tools — client methods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("flagMessage", () => {
    const argvOf = () => mockExecFileAsync.mock.calls.at(-1)![1] as string[];

    it("v2: one --flag per flag, lowercased, id after the options", async () => {
      setupMock("{}");
      const client = new HimalayaClient({ account: "" });
      await client.flagMessage("42", ["Seen", "Flagged"], "add");
      expect(argvOf()).toEqual(["flag", "add", "--flag", "seen", "--flag", "flagged", "--json", "42"]);
    });

    it("v2: flag remove", async () => {
      setupMock("{}");
      const client = new HimalayaClient({ account: "" });
      await client.flagMessage("42", ["Flagged"], "remove");
      expect(argvOf()).toEqual(["flag", "remove", "--flag", "flagged", "--json", "42"]);
    });

    it("v2: rejects a flag the shared command does not support", async () => {
      setupMock("{}");
      const client = new HimalayaClient({ account: "" });
      await expect(client.flagMessage("42", ["Deleted"], "add")).rejects.toThrow(/not supported by himalaya v2/);
    });

    it("v1: flags as positionals after the id", async () => {
      mockExecFileAsync
        .mockResolvedValueOnce({ stdout: "himalaya v1.2.0 +imap", stderr: "" })
        .mockResolvedValue({ stdout: "{}", stderr: "" });
      const client = new HimalayaClient({ account: "" });
      await client.flagMessage("42", ["Seen", "Flagged"], "add");
      expect(argvOf()).toEqual(["flag", "add", "42", "Seen", "Flagged", "--output", "json"]);
    });

    it("passes folder when not INBOX", async () => {
      setupMock("{}");
      const client = new HimalayaClient();
      await client.flagMessage("42", ["Seen"], "add", "Sent Items");

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "himalaya",
        expect.arrayContaining(["--mailbox", "Sent Items"]),
        expect.any(Object),
      );
    });

    it("passes account when specified", async () => {
      setupMock("{}");
      const client = new HimalayaClient();
      await client.flagMessage("42", ["Seen"], "add", undefined, "work");

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "himalaya",
        expect.arrayContaining(["--account", "work"]),
        expect.any(Object),
      );
    });
  });

  describe("moveMessage", () => {
    it("v2: --to the target and --from the source, id after the options", async () => {
      setupMock("{}");
      const client = new HimalayaClient({ account: "" });
      await client.moveMessage("42", "Archive");
      expect(mockExecFileAsync.mock.calls.at(-1)![1]).toEqual(
        ["message", "move", "--to", "Archive", "--from", "INBOX", "--json", "42"],
      );
    });

    it("v2: the source folder goes to --from, never --mailbox", async () => {
      setupMock("{}");
      const client = new HimalayaClient({ account: "" });
      await client.moveMessage("42", "Trash", "Sent Items");
      const argv = mockExecFileAsync.mock.calls.at(-1)![1] as string[];
      expect(argv).toEqual(["message", "move", "--to", "Trash", "--from", "Sent Items", "--json", "42"]);
      expect(argv).not.toContain("--mailbox");
    });

    it("v1: target then id, source as --folder", async () => {
      mockExecFileAsync
        .mockResolvedValueOnce({ stdout: "himalaya v1.2.0 +imap", stderr: "" })
        .mockResolvedValue({ stdout: "{}", stderr: "" });
      const client = new HimalayaClient({ account: "" });
      await client.moveMessage("42", "Trash", "Sent Items");
      expect(mockExecFileAsync.mock.calls.at(-1)![1]).toEqual(
        ["message", "move", "Trash", "42", "--folder", "Sent Items", "--output", "json"],
      );
    });

    it("passes account when specified", async () => {
      setupMock("{}");
      const client = new HimalayaClient();
      await client.moveMessage("42", "Trash", undefined, "work");

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "himalaya",
        expect.arrayContaining(["--account", "work"]),
        expect.any(Object),
      );
    });
  });
});
