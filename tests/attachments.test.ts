import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HimalayaClient } from "../src/himalaya/client.js";
import { registerAttachmentTools } from "../src/tools/attachments.js";

// Mock node modules
vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("node:os", () => ({
  tmpdir: vi.fn().mockReturnValue("/tmp"),
}));

vi.mock("node:crypto", () => ({
  randomUUID: vi.fn().mockReturnValue("test-uuid-1234"),
}));

const SAMPLE_ATTACHMENTS = JSON.stringify([
  { filename: "report.pdf", mime: "application/pdf", size: 245760 },
  { filename: "photo.jpg", mime: "image/jpeg", size: 1048576 },
]);

function createMockClient(): HimalayaClient {
  const client = new HimalayaClient();
  vi.spyOn(client, "listAttachments").mockResolvedValue(SAMPLE_ATTACHMENTS);
  vi.spyOn(client, "downloadAttachment").mockResolvedValue("{}");
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
    it("returns formatted attachment list", async () => {
      const tool = getToolHandler(server, "list_attachments");
      const result = await tool.handler({ id: "42", folder: undefined, account: undefined }, {} as any);

      const text = result.content[0].text;
      expect(text).toContain("report.pdf");
      expect(text).toContain("application/pdf");
      expect(text).toContain("240 KB");
      expect(text).toContain("photo.jpg");
    });

    it("passes folder parameter", async () => {
      const tool = getToolHandler(server, "list_attachments");
      await tool.handler({ id: "42", folder: "Sent", account: undefined }, {} as any);
      expect(client.listAttachments).toHaveBeenCalledWith("42", "Sent", undefined);
    });

    it("passes account parameter", async () => {
      const tool = getToolHandler(server, "list_attachments");
      await tool.handler({ id: "42", folder: undefined, account: "work" }, {} as any);
      expect(client.listAttachments).toHaveBeenCalledWith("42", undefined, "work");
    });

    it("handles empty results", async () => {
      vi.spyOn(client, "listAttachments").mockResolvedValue("[]");
      const tool = getToolHandler(server, "list_attachments");
      const result = await tool.handler({ id: "42", folder: undefined, account: undefined }, {} as any);
      expect(result.content[0].text).toContain("No attachments");
    });

    it("handles errors", async () => {
      vi.spyOn(client, "listAttachments").mockRejectedValue(new Error("not found"));
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

    it("calls client with correct params", async () => {
      const tool = getToolHandler(server, "download_attachment");
      await tool.handler({
        id: "42", filename: "report.pdf", folder: undefined, account: undefined,
      }, {} as any);

      expect(client.downloadAttachment).toHaveBeenCalledWith(
        "42", "report.pdf", "/tmp/himalaya-mcp-test-uuid-1234", undefined, undefined
      );
    });

    it("passes folder and account", async () => {
      const tool = getToolHandler(server, "download_attachment");
      await tool.handler({
        id: "42", filename: "report.pdf", folder: "Sent", account: "work",
      }, {} as any);

      expect(client.downloadAttachment).toHaveBeenCalledWith(
        "42", "report.pdf", expect.any(String), "Sent", "work"
      );
    });

    it("handles download errors", async () => {
      vi.spyOn(client, "downloadAttachment").mockRejectedValue(new Error("download failed"));
      const tool = getToolHandler(server, "download_attachment");
      const result = await tool.handler({
        id: "42", filename: "report.pdf", folder: undefined, account: undefined,
      }, {} as any);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error downloading attachment");
    });
  });
});
