import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HimalayaClient } from "../src/himalaya/client.js";
import { registerComposeNewTools } from "../src/tools/compose-new.js";

function createMockClient(): HimalayaClient {
  const client = new HimalayaClient();
  vi.spyOn(client, "sendTemplate").mockResolvedValue("{}");
  return client;
}

function getToolHandler(server: McpServer, toolName: string) {
  const tools = (server as any)._registeredTools as Record<string, any>;
  const tool = tools?.[toolName];
  if (!tool) throw new Error(`Tool "${toolName}" not registered`);
  return tool;
}

describe("Compose new email tool", () => {
  let server: McpServer;
  let client: HimalayaClient;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    registerComposeNewTools(server, client);
  });

  describe("compose_email", () => {
    it("without confirm — returns preview with To, Subject, Body", async () => {
      const tool = getToolHandler(server, "compose_email");
      const result = await tool.handler({
        to: "alice@example.com", subject: "Meeting", body: "Hello Alice",
        cc: undefined, bcc: undefined, confirm: undefined, account: undefined,
      }, {} as any);

      const text = result.content[0].text;
      expect(text).toContain("PREVIEW");
      expect(text).toContain("NOT been sent");
      expect(text).toContain("alice@example.com");
      expect(text).toContain("Meeting");
      expect(text).toContain("Hello Alice");
      expect(client.sendTemplate).not.toHaveBeenCalled();
    });

    it("without confirm — does NOT call sendTemplate", async () => {
      const tool = getToolHandler(server, "compose_email");
      await tool.handler({
        to: "test@test.com", subject: "Test", body: "Body",
        cc: undefined, bcc: undefined, confirm: false, account: undefined,
      }, {} as any);

      expect(client.sendTemplate).not.toHaveBeenCalled();
    });

    it("with confirm=true — sends and returns success", async () => {
      const tool = getToolHandler(server, "compose_email");
      const result = await tool.handler({
        to: "alice@example.com", subject: "Meeting", body: "Hello",
        cc: undefined, bcc: undefined, confirm: true, account: undefined,
      }, {} as any);

      expect(result.content[0].text).toContain("sent successfully");
      expect(result.content[0].text).toContain("alice@example.com");
      expect(client.sendTemplate).toHaveBeenCalled();
    });

    it("includes Cc header when provided", async () => {
      const tool = getToolHandler(server, "compose_email");
      const result = await tool.handler({
        to: "alice@example.com", subject: "Meeting", body: "Hello",
        cc: "bob@example.com", bcc: undefined, confirm: undefined, account: undefined,
      }, {} as any);

      expect(result.content[0].text).toContain("Cc: bob@example.com");
    });

    it("includes Bcc header when provided", async () => {
      const tool = getToolHandler(server, "compose_email");
      const result = await tool.handler({
        to: "alice@example.com", subject: "Meeting", body: "Hello",
        cc: undefined, bcc: "secret@example.com", confirm: undefined, account: undefined,
      }, {} as any);

      expect(result.content[0].text).toContain("Bcc: secret@example.com");
    });

    it("handles send errors gracefully", async () => {
      vi.spyOn(client, "sendTemplate").mockRejectedValue(new Error("SMTP error"));
      const tool = getToolHandler(server, "compose_email");
      const result = await tool.handler({
        to: "alice@example.com", subject: "Test", body: "Body",
        cc: undefined, bcc: undefined, confirm: true, account: undefined,
      }, {} as any);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error sending email");
    });

    it("passes account parameter when sending", async () => {
      const tool = getToolHandler(server, "compose_email");
      await tool.handler({
        to: "alice@example.com", subject: "Test", body: "Body",
        cc: undefined, bcc: undefined, confirm: true, account: "work",
      }, {} as any);

      expect(client.sendTemplate).toHaveBeenCalledWith(
        expect.any(String),
        "work"
      );
    });

    it("template does not include Cc/Bcc when not provided", async () => {
      const tool = getToolHandler(server, "compose_email");
      const result = await tool.handler({
        to: "alice@example.com", subject: "Test", body: "Body",
        cc: undefined, bcc: undefined, confirm: undefined, account: undefined,
      }, {} as any);

      const text = result.content[0].text;
      expect(text).not.toContain("Cc:");
      expect(text).not.toContain("Bcc:");
    });
  });
});
