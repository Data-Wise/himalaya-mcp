import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HimalayaClient } from "../src/himalaya/client.js";
import { registerComposeTools } from "../src/tools/compose.js";

// --- Mock client ---

const SAMPLE_REPLY_TEMPLATE = JSON.stringify(
  "From: user@example.com\nTo: alice@example.com\nSubject: Re: Meeting Tomorrow\nIn-Reply-To: <msg123@example.com>\n\n\n> Dear colleague,\n> This is a reminder about tomorrow's meeting."
);

function createMockClient(): HimalayaClient {
  const client = new HimalayaClient();
  vi.spyOn(client, "replyTemplate").mockResolvedValue(SAMPLE_REPLY_TEMPLATE);
  vi.spyOn(client, "sendTemplate").mockResolvedValue("{}");
  return client;
}

function getToolHandler(server: McpServer, toolName: string) {
  const tools = (server as any)._registeredTools as Record<string, any>;
  const tool = tools?.[toolName];
  if (!tool) throw new Error(`Tool "${toolName}" not registered`);
  return tool;
}

describe("Compose tools", () => {
  let server: McpServer;
  let client: HimalayaClient;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    registerComposeTools(server, client);
  });

  describe("draft_reply", () => {
    it("returns reply template with DRAFT markers", async () => {
      const tool = getToolHandler(server, "draft_reply");
      const result = await tool.handler({
        id: "42", body: undefined, reply_all: undefined,
        folder: undefined, account: undefined,
      }, {} as any);

      const text = result.content[0].text;
      expect(text).toContain("DRAFT REPLY");
      expect(text).toContain("not sent");
      expect(text).toContain("From: user@example.com");
      expect(text).toContain("Re: Meeting Tomorrow");
      expect(text).toContain("send_email");
    });

    it("passes reply_all flag", async () => {
      const tool = getToolHandler(server, "draft_reply");
      await tool.handler({
        id: "42", body: undefined, reply_all: true,
        folder: undefined, account: undefined,
      }, {} as any);

      expect(client.replyTemplate).toHaveBeenCalledWith("42", undefined, true, undefined, undefined);
    });

    it("passes body text", async () => {
      const tool = getToolHandler(server, "draft_reply");
      await tool.handler({
        id: "42", body: "Thanks, confirmed!", reply_all: undefined,
        folder: undefined, account: undefined,
      }, {} as any);

      expect(client.replyTemplate).toHaveBeenCalledWith("42", "Thanks, confirmed!", undefined, undefined, undefined);
    });

    it("handles errors gracefully", async () => {
      vi.spyOn(client, "replyTemplate").mockRejectedValue(new Error("not found"));
      const tool = getToolHandler(server, "draft_reply");
      const result = await tool.handler({
        id: "999", body: undefined, reply_all: undefined,
        folder: undefined, account: undefined,
      }, {} as any);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error drafting reply");
    });
  });

  describe("send_email", () => {
    it("without confirm — returns preview, does NOT send", async () => {
      const tool = getToolHandler(server, "send_email");
      const template = "From: me@test.com\nTo: you@test.com\nSubject: Hi\n\nHello!";
      const result = await tool.handler({
        template, confirm: undefined, account: undefined,
      }, {} as any);

      const text = result.content[0].text;
      expect(text).toContain("PREVIEW");
      expect(text).toContain("NOT been sent");
      expect(text).toContain(template);
      expect(client.sendTemplate).not.toHaveBeenCalled();
    });

    it("with confirm=false — returns preview, does NOT send", async () => {
      const tool = getToolHandler(server, "send_email");
      const result = await tool.handler({
        template: "test", confirm: false, account: undefined,
      }, {} as any);

      expect(result.content[0].text).toContain("NOT been sent");
      expect(client.sendTemplate).not.toHaveBeenCalled();
    });

    it("with confirm=true — actually sends", async () => {
      const tool = getToolHandler(server, "send_email");
      const template = "From: me@test.com\nTo: you@test.com\nSubject: Hi\n\nHello!";
      const result = await tool.handler({
        template, confirm: true, account: undefined,
      }, {} as any);

      expect(result.content[0].text).toContain("sent successfully");
      expect(client.sendTemplate).toHaveBeenCalledWith(template, undefined);
    });

    it("with confirm=true — handles send errors", async () => {
      vi.spyOn(client, "sendTemplate").mockRejectedValue(new Error("SMTP error"));
      const tool = getToolHandler(server, "send_email");
      const result = await tool.handler({
        template: "test", confirm: true, account: undefined,
      }, {} as any);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error sending email");
    });

    it("passes account when specified", async () => {
      const tool = getToolHandler(server, "send_email");
      await tool.handler({
        template: "test", confirm: true, account: "work",
      }, {} as any);

      expect(client.sendTemplate).toHaveBeenCalledWith("test", "work");
    });
  });
});
