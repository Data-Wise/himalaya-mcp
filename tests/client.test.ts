import { describe, it, expect, vi, beforeEach } from "vitest";
import { promisify } from "node:util";
import { HimalayaClient } from "../src/himalaya/client.js";

// Mock node:child_process - we use execFile (safe, no shell injection).
// Must preserve util.promisify.custom so promisify(execFile) returns {stdout, stderr}.
vi.mock("node:child_process", async () => {
  const { promisify: realPromisify } = await import("node:util");
  const fn: any = vi.fn();
  const promisified = vi.fn();
  fn[realPromisify.custom] = promisified;
  return { execFile: fn };
});

import { execFile } from "node:child_process";

const mockExecFile = vi.mocked(execFile);
// Access the promisified version that client.ts actually calls
const mockExecFileAsync = (execFile as any)[promisify.custom] as ReturnType<typeof vi.fn>;

function setupMock(stdout: string, stderr = "") {
  mockExecFileAsync.mockResolvedValue({ stdout, stderr });
}

function setupErrorMock(error: Error) {
  mockExecFileAsync.mockRejectedValue(error);
}

describe("HimalayaClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("uses default options", () => {
      const client = new HimalayaClient();
      expect(client).toBeDefined();
    });

    it("accepts custom options", () => {
      const client = new HimalayaClient({
        binary: "/usr/local/bin/himalaya",
        account: "work",
        folder: "Sent Items",
        timeout: 60_000,
      });
      expect(client).toBeDefined();
    });
  });

  describe("exec", () => {
    it("passes --output json flag", async () => {
      setupMock("[]");
      const client = new HimalayaClient();
      await client.exec(["envelope", "list"]);

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "himalaya",
        expect.arrayContaining(["--output", "json"]),
        expect.any(Object),
      );
    });

    it("passes --account flag when set", async () => {
      setupMock("[]");
      const client = new HimalayaClient({ account: "work" });
      await client.exec(["envelope", "list"]);

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "himalaya",
        expect.arrayContaining(["--account", "work"]),
        expect.any(Object),
      );
    });

    it("returns stdout", async () => {
      setupMock('[{"id":"1"}]');
      const client = new HimalayaClient();
      const result = await client.exec(["envelope", "list"]);
      expect(result).toBe('[{"id":"1"}]');
    });
  });

  describe("error handling", () => {
    it("wraps ENOENT as CLI not found", async () => {
      const err = Object.assign(new Error("spawn himalaya ENOENT"), { code: "ENOENT" });
      setupErrorMock(err);
      const client = new HimalayaClient();

      await expect(client.exec(["envelope", "list"]))
        .rejects.toThrow("himalaya CLI not found");
    });

    it("wraps killed process as timeout", async () => {
      const err = Object.assign(new Error("killed"), { killed: true });
      setupErrorMock(err);
      const client = new HimalayaClient();

      await expect(client.exec(["envelope", "list"]))
        .rejects.toThrow("timed out");
    });

    it("wraps auth errors", async () => {
      const err = new Error("authentication failed: bad credentials");
      setupErrorMock(err);
      const client = new HimalayaClient();

      await expect(client.exec(["envelope", "list"]))
        .rejects.toThrow("authentication failed");
    });
  });

  describe("convenience methods", () => {
    it("listEnvelopes builds correct args", async () => {
      setupMock("[]");
      const client = new HimalayaClient();
      await client.listEnvelopes("Sent Items", 10, 2);

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "himalaya",
        expect.arrayContaining(["envelope", "list", "--folder", "Sent Items", "--page-size", "10", "--page", "2"]),
        expect.any(Object),
      );
    });

    it("searchEnvelopes passes query", async () => {
      setupMock("[]");
      const client = new HimalayaClient();
      await client.searchEnvelopes("invoice", "INBOX");

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "himalaya",
        expect.arrayContaining(["envelope", "list", "-q", "invoice"]),
        expect.any(Object),
      );
    });

    it("readMessage passes id", async () => {
      setupMock('""');
      const client = new HimalayaClient();
      await client.readMessage("12345");

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "himalaya",
        expect.arrayContaining(["message", "read", "12345"]),
        expect.any(Object),
      );
    });

    it("listFolders calls folder list", async () => {
      setupMock("[]");
      const client = new HimalayaClient();
      await client.listFolders();

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "himalaya",
        expect.arrayContaining(["folder", "list"]),
        expect.any(Object),
      );
    });
  });
});
