import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HimalayaClient } from "../src/himalaya/client.js";
import { registerAttachmentTools } from "../src/tools/attachments.js";

// Mock node modules — simulate downloaded files in temp dir
vi.mock("node:fs/promises", () => ({
  rm: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue(["report.pdf", "photo.jpg", "plain.txt", "index.html"]),
  stat: vi.fn().mockImplementation((path: string) => {
    if (path.includes("report.pdf")) return Promise.resolve({ isFile: () => true, size: 245760 });
    if (path.includes("photo.jpg")) return Promise.resolve({ isFile: () => true, size: 1048576 });
    if (path.includes("plain.txt")) return Promise.resolve({ isFile: () => true, size: 150 });
    if (path.includes("index.html")) return Promise.resolve({ isFile: () => true, size: 300 });
    return Promise.resolve({ isFile: () => false, size: 0 });
  }),
}));

vi.mock("node:os", () => ({
  tmpdir: vi.fn().mockReturnValue("/tmp"),
}));

vi.mock("node:crypto", () => ({
  randomUUID: vi.fn().mockReturnValue("test-uuid-1234"),
}));

function createMockClient(): HimalayaClient {
  const client = new HimalayaClient();
  vi.spyOn(client, "downloadAttachments").mockResolvedValue("{}");
  return client;
}

function getToolHandler(server: McpServer, toolName: string) {
  const tools = (server as any)._registeredTools as Record<string, any>;
  const tool = tools?.[toolName];
  if (!tool) throw new Error(`Tool "${toolName}" not registered`);
  return tool;
}

describe("Attachment tools", () => {
  let server: McpServer;
  let client: HimalayaClient;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    registerAttachmentTools(server, client);
  });

  describe("list_attachments", () => {
    it("returns formatted attachment list (body parts filtered)", async () => {
      const tool = getToolHandler(server, "list_attachments");
      const result = await tool.handler({ id: "42", folder: undefined, account: undefined }, {} as any);

      const text = result.content[0].text;
      expect(text).toContain("report.pdf");
      expect(text).toContain("application/pdf");
      expect(text).toContain("240 KB");
      expect(text).toContain("photo.jpg");
      // Body parts should be filtered out
      expect(text).not.toContain("plain.txt");
      expect(text).not.toContain("index.html");
    });

    it("passes folder parameter to downloadAttachments", async () => {
      const tool = getToolHandler(server, "list_attachments");
      await tool.handler({ id: "42", folder: "Sent", account: undefined }, {} as any);
      expect(client.downloadAttachments).toHaveBeenCalledWith("42", expect.any(String), "Sent", undefined);
    });

    it("passes account parameter to downloadAttachments", async () => {
      const tool = getToolHandler(server, "list_attachments");
      await tool.handler({ id: "42", folder: undefined, account: "work" }, {} as any);
      expect(client.downloadAttachments).toHaveBeenCalledWith("42", expect.any(String), undefined, "work");
    });

    it("handles empty results (no real attachments)", async () => {
      const { readdir } = await import("node:fs/promises");
      // Only body parts, no real attachments
      vi.mocked(readdir).mockResolvedValueOnce(["plain.txt", "index.html"] as any);
      const tool = getToolHandler(server, "list_attachments");
      const result = await tool.handler({ id: "42", folder: undefined, account: undefined }, {} as any);
      expect(result.content[0].text).toContain("No attachments");
    });

    it("handles errors", async () => {
      vi.spyOn(client, "downloadAttachments").mockRejectedValue(new Error("not found"));
      const tool = getToolHandler(server, "list_attachments");
      const result = await tool.handler({ id: "999", folder: undefined, account: undefined }, {} as any);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error listing attachments");
    });
  });

  describe("download_attachment", () => {
    it("downloads to temp directory and returns path", async () => {
      const tool = getToolHandler(server, "download_attachment");
      const result = await tool.handler({
        id: "42", filename: "report.pdf", folder: undefined, account: undefined,
      }, {} as any);

      const text = result.content[0].text;
      expect(text).toContain("Downloaded");
      expect(text).toContain("report.pdf");
      expect(text).toContain("/tmp/himalaya-mcp-test-uuid-1234");
    });

    it("calls client.downloadAttachments with correct params", async () => {
      const tool = getToolHandler(server, "download_attachment");
      await tool.handler({
        id: "42", filename: "report.pdf", folder: undefined, account: undefined,
      }, {} as any);

      expect(client.downloadAttachments).toHaveBeenCalledWith(
        "42", "/tmp/himalaya-mcp-test-uuid-1234", undefined, undefined
      );
    });

    it("passes folder and account", async () => {
      const tool = getToolHandler(server, "download_attachment");
      await tool.handler({
        id: "42", filename: "report.pdf", folder: "Sent", account: "work",
      }, {} as any);

      expect(client.downloadAttachments).toHaveBeenCalledWith(
        "42", expect.any(String), "Sent", "work"
      );
    });

    it("returns error when filename not found", async () => {
      const { readdir } = await import("node:fs/promises");
      vi.mocked(readdir).mockResolvedValueOnce(["other.doc"] as any);
      const { stat } = await import("node:fs/promises");
      vi.mocked(stat).mockResolvedValueOnce({ isFile: () => true, size: 5000 } as any);

      const tool = getToolHandler(server, "download_attachment");
      const result = await tool.handler({
        id: "42", filename: "missing.pdf", folder: undefined, account: undefined,
      }, {} as any);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not found");
      expect(result.content[0].text).toContain("other.doc");
    });

    it("handles download errors", async () => {
      vi.spyOn(client, "downloadAttachments").mockRejectedValue(new Error("download failed"));
      const tool = getToolHandler(server, "download_attachment");
      const result = await tool.handler({
        id: "42", filename: "report.pdf", folder: undefined, account: undefined,
      }, {} as any);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error downloading attachment");
    });
  });
});
