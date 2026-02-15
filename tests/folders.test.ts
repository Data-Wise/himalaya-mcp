import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HimalayaClient } from "../src/himalaya/client.js";
import { registerFolderTools } from "../src/tools/folders.js";

// --- Mock client ---

const SAMPLE_FOLDERS = JSON.stringify([
  { name: "INBOX", desc: "" },
  { name: "Sent", desc: "" },
  { name: "Archive", desc: "Archived messages" },
]);

function createMockClient(): HimalayaClient {
  const client = new HimalayaClient();
  vi.spyOn(client, "listFolders").mockResolvedValue(SAMPLE_FOLDERS);
  vi.spyOn(client, "createFolder").mockResolvedValue("{}");
  vi.spyOn(client, "deleteFolder").mockResolvedValue("{}");
  return client;
}

function getToolHandler(server: McpServer, toolName: string) {
  const tools = (server as any)._registeredTools as Record<string, any>;
  const tool = tools?.[toolName];
  if (!tool) throw new Error(`Tool "${toolName}" not registered`);
  return tool;
}

describe("Folder tools", () => {
  let server: McpServer;
  let client: HimalayaClient;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    registerFolderTools(server, client);
  });

  describe("list_folders", () => {
    it("returns folder list", async () => {
      const tool = getToolHandler(server, "list_folders");
      const result = await tool.handler({
        account: undefined,
      }, {} as any);

      const text = result.content[0].text;
      expect(text).toContain("- INBOX");
      expect(text).toContain("- Sent");
      expect(text).toContain("- Archive (Archived messages)");
    });

    it("passes account parameter", async () => {
      const tool = getToolHandler(server, "list_folders");
      await tool.handler({
        account: "work",
      }, {} as any);

      expect(client.listFolders).toHaveBeenCalledWith("work");
    });

    it("handles errors", async () => {
      vi.spyOn(client, "listFolders").mockRejectedValue(new Error("connection failed"));
      const tool = getToolHandler(server, "list_folders");
      const result = await tool.handler({
        account: undefined,
      }, {} as any);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error listing folders");
      expect(result.content[0].text).toContain("connection failed");
    });

    it("handles parse errors", async () => {
      vi.spyOn(client, "listFolders").mockResolvedValue("not valid json");
      const tool = getToolHandler(server, "list_folders");
      const result = await tool.handler({
        account: undefined,
      }, {} as any);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error listing folders");
    });
  });

  describe("create_folder", () => {
    it("creates folder and returns success", async () => {
      const tool = getToolHandler(server, "create_folder");
      const result = await tool.handler({
        name: "Projects",
        account: undefined,
      }, {} as any);

      const text = result.content[0].text;
      expect(text).toContain('Folder "Projects" created successfully');
      expect(client.createFolder).toHaveBeenCalledWith("Projects", undefined);
    });

    it("passes account parameter", async () => {
      const tool = getToolHandler(server, "create_folder");
      await tool.handler({
        name: "Projects",
        account: "work",
      }, {} as any);

      expect(client.createFolder).toHaveBeenCalledWith("Projects", "work");
    });

    it("handles errors", async () => {
      vi.spyOn(client, "createFolder").mockRejectedValue(new Error("folder exists"));
      const tool = getToolHandler(server, "create_folder");
      const result = await tool.handler({
        name: "INBOX",
        account: undefined,
      }, {} as any);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error creating folder");
      expect(result.content[0].text).toContain("folder exists");
    });
  });

  describe("delete_folder", () => {
    it("without confirm returns preview warning", async () => {
      const tool = getToolHandler(server, "delete_folder");
      const result = await tool.handler({
        name: "OldStuff",
        confirm: undefined,
        account: undefined,
      }, {} as any);

      const text = result.content[0].text;
      expect(text).toContain("DELETE FOLDER PREVIEW");
      expect(text).toContain("OldStuff");
      expect(text).toContain("NOT been deleted");
      expect(client.deleteFolder).not.toHaveBeenCalled();
    });

    it("with confirm=false returns preview warning", async () => {
      const tool = getToolHandler(server, "delete_folder");
      const result = await tool.handler({
        name: "OldStuff",
        confirm: false,
        account: undefined,
      }, {} as any);

      const text = result.content[0].text;
      expect(text).toContain("DELETE FOLDER PREVIEW");
      expect(client.deleteFolder).not.toHaveBeenCalled();
    });

    it("with confirm=true deletes folder", async () => {
      const tool = getToolHandler(server, "delete_folder");
      const result = await tool.handler({
        name: "OldStuff",
        confirm: true,
        account: undefined,
      }, {} as any);

      const text = result.content[0].text;
      expect(text).toContain('Folder "OldStuff" deleted successfully');
      expect(client.deleteFolder).toHaveBeenCalledWith("OldStuff", undefined);
    });

    it("passes account parameter when confirmed", async () => {
      const tool = getToolHandler(server, "delete_folder");
      await tool.handler({
        name: "OldStuff",
        confirm: true,
        account: "personal",
      }, {} as any);

      expect(client.deleteFolder).toHaveBeenCalledWith("OldStuff", "personal");
    });

    it("handles errors", async () => {
      vi.spyOn(client, "deleteFolder").mockRejectedValue(new Error("permission denied"));
      const tool = getToolHandler(server, "delete_folder");
      const result = await tool.handler({
        name: "INBOX",
        confirm: true,
        account: undefined,
      }, {} as any);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error deleting folder");
      expect(result.content[0].text).toContain("permission denied");
    });
  });
});
