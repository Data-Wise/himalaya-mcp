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
  mockExecFileAsync.mockResolvedValue({ stdout, stderr });
}

describe("Manage tools — client methods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("flagMessage", () => {
    it("builds correct args for flag add", async () => {
      setupMock("{}");
      const client = new HimalayaClient();
      await client.flagMessage("42", ["Seen", "Flagged"], "add");

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "himalaya",
        expect.arrayContaining(["flag", "add", "42", "Seen", "Flagged"]),
        expect.any(Object),
      );
    });

    it("builds correct args for flag remove", async () => {
      setupMock("{}");
      const client = new HimalayaClient();
      await client.flagMessage("42", ["Flagged"], "remove");

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "himalaya",
        expect.arrayContaining(["flag", "remove", "42", "Flagged"]),
        expect.any(Object),
      );
    });

    it("passes folder when not INBOX", async () => {
      setupMock("{}");
      const client = new HimalayaClient();
      await client.flagMessage("42", ["Seen"], "add", "Sent Items");

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "himalaya",
        expect.arrayContaining(["--folder", "Sent Items"]),
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
    it("builds correct args for message move", async () => {
      setupMock("{}");
      const client = new HimalayaClient();
      await client.moveMessage("42", "Archive");

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "himalaya",
        expect.arrayContaining(["message", "move", "Archive", "42"]),
        expect.any(Object),
      );
    });

    it("passes folder when not INBOX", async () => {
      setupMock("{}");
      const client = new HimalayaClient();
      await client.moveMessage("42", "Trash", "Sent Items");

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "himalaya",
        expect.arrayContaining(["--folder", "Sent Items"]),
        expect.any(Object),
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
