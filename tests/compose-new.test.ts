import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HimalayaClient } from "../src/himalaya/client.js";
import { registerComposeNewTools } from "../src/tools/compose-new.js";
import { tmpdir } from "node:os";
import { writeFileSync, unlinkSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

function createMockClient(): HimalayaClient {
  const client = new HimalayaClient({ from: "sender@example.com", account: "work" });
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
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env["HIMALAYA_CONFIG"];
    delete process.env["HIMALAYA_FROM"];
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    registerComposeNewTools(server, client);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("compose_email", () => {
    it("without confirm — returns preview with To, Subject, Body", async () => {
      const tool = getToolHandler(server, "compose_email");
      const result = await tool.handler({
        to: "alice@example.com", subject: "Meeting", body: "Hello Alice",
        cc: undefined, bcc: undefined, attachments: undefined, confirm: undefined, account: undefined,
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
        cc: undefined, bcc: undefined, attachments: undefined, confirm: false, account: undefined,
      }, {} as any);

      expect(client.sendTemplate).not.toHaveBeenCalled();
    });

    it("with confirm=true — sends and returns success", async () => {
      const tool = getToolHandler(server, "compose_email");
      const result = await tool.handler({
        to: "alice@example.com", subject: "Meeting", body: "Hello",
        cc: undefined, bcc: undefined, attachments: undefined, confirm: true, account: undefined,
      }, {} as any);

      expect(result.content[0].text).toContain("sent successfully");
      expect(result.content[0].text).toContain("alice@example.com");
      expect(client.sendTemplate).toHaveBeenCalled();
    });

    it("includes Cc header when provided", async () => {
      const tool = getToolHandler(server, "compose_email");
      const result = await tool.handler({
        to: "alice@example.com", subject: "Meeting", body: "Hello",
        cc: "bob@example.com", bcc: undefined, attachments: undefined, confirm: undefined, account: undefined,
      }, {} as any);

      expect(result.content[0].text).toContain("Cc: bob@example.com");
    });

    it("includes Bcc header when provided", async () => {
      const tool = getToolHandler(server, "compose_email");
      const result = await tool.handler({
        to: "alice@example.com", subject: "Meeting", body: "Hello",
        cc: undefined, bcc: "secret@example.com", attachments: undefined, confirm: undefined, account: undefined,
      }, {} as any);

      expect(result.content[0].text).toContain("Bcc: secret@example.com");
    });

    it("handles send errors gracefully", async () => {
      vi.spyOn(client, "sendTemplate").mockRejectedValue(new Error("SMTP error"));
      const tool = getToolHandler(server, "compose_email");
      const result = await tool.handler({
        to: "alice@example.com", subject: "Test", body: "Body",
        cc: undefined, bcc: undefined, attachments: undefined, confirm: true, account: undefined,
      }, {} as any);

      expect(result.isError).toBe(true);
      const envelope = JSON.parse(result.content[0].text as string).error;
      expect(envelope.message).toContain("SMTP error");
    });

    it("passes account parameter when sending", async () => {
      const tool = getToolHandler(server, "compose_email");
      await tool.handler({
        to: "alice@example.com", subject: "Test", body: "Body",
        cc: undefined, bcc: undefined, attachments: undefined, confirm: true, account: "work",
      }, {} as any);

      expect(client.sendTemplate).toHaveBeenCalledWith(
        expect.any(String),
        "work"
      );
    });

    it("uses the sender address for a per-call account override", async () => {
      const tempDir = mkdtempSync(join(tmpdir(), "himalaya-compose-"));
      const configPath = join(tempDir, "config.toml");
      writeFileSync(configPath, `
[accounts.work]
email = "work@example.com"

[accounts.personal]
email = "personal@example.com"
default = true
`, "utf-8");
      process.env["HIMALAYA_CONFIG"] = configPath;

      try {
        const tool = getToolHandler(server, "compose_email");
        const result = await tool.handler({
          to: "alice@example.com", subject: "Test", body: "Body",
          cc: undefined, bcc: undefined, attachments: undefined, confirm: undefined, account: "personal",
        }, {} as any);

        expect(result.content[0].text).toContain("From: personal@example.com");
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("template does not include Cc/Bcc when not provided", async () => {
      const tool = getToolHandler(server, "compose_email");
      const result = await tool.handler({
        to: "alice@example.com", subject: "Test", body: "Body",
        cc: undefined, bcc: undefined, attachments: undefined, confirm: undefined, account: undefined,
      }, {} as any);

      const text = result.content[0].text;
      expect(text).not.toContain("Cc:");
      expect(text).not.toContain("Bcc:");
    });

    describe("attachments", () => {
      let tmpFile: string;

      beforeEach(() => {
        tmpFile = join(tmpdir(), `test-attach-${process.pid}.pdf`);
        writeFileSync(tmpFile, "fake pdf content");
      });

      afterEach(() => {
        try { unlinkSync(tmpFile); } catch { /* ignore */ }
      });

      it("attachment path appears in preview template", async () => {
        const tool = getToolHandler(server, "compose_email");
        const result = await tool.handler({
          to: "alice@example.com", subject: "Test", body: "See attached",
          cc: undefined, bcc: undefined, attachments: [tmpFile], confirm: undefined, account: undefined,
        }, {} as any);

        const text = result.content[0].text;
        expect(text).toContain("<#part");
        expect(text).toContain(tmpFile);
        expect(text).toContain("<#/part>");
        expect(text).toContain("application/pdf");
      });

      it("attachment MML is included when confirm=true", async () => {
        const tool = getToolHandler(server, "compose_email");
        await tool.handler({
          to: "alice@example.com", subject: "Test", body: "See attached",
          cc: undefined, bcc: undefined, attachments: [tmpFile], confirm: true, account: undefined,
        }, {} as any);

        const [templateArg] = (client.sendTemplate as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(templateArg).toContain("<#part");
        expect(templateArg).toContain(tmpFile);
      });

      it("missing attachment path returns error before sending", async () => {
        const tool = getToolHandler(server, "compose_email");
        const result = await tool.handler({
          to: "alice@example.com", subject: "Test", body: "Body",
          cc: undefined, bcc: undefined, attachments: ["/nonexistent/file.pdf"], confirm: true, account: undefined,
        }, {} as any);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("not found");
        expect(client.sendTemplate).not.toHaveBeenCalled();
      });

      it("no <#part> sections when attachments is empty and body is plain text", async () => {
        const tool = getToolHandler(server, "compose_email");
        const result = await tool.handler({
          to: "alice@example.com", subject: "Test", body: "Body",
          cc: undefined, bcc: undefined, attachments: [], confirm: undefined, account: undefined,
        }, {} as any);

        expect(result.content[0].text).not.toContain("<#part");
      });
    });

    describe("HTML email", () => {
      it("wraps HTML body in <#part type=\"text/html\">", async () => {
        const tool = getToolHandler(server, "compose_email");
        const htmlBody = "<html><body><h1>Hello</h1><p>World</p></body></html>";
        const result = await tool.handler({
          to: "alice@example.com", subject: "Test", body: htmlBody,
          cc: undefined, bcc: undefined, attachments: undefined, confirm: undefined, account: undefined,
        }, {} as any);

        const text = result.content[0].text;
        expect(text).toContain('<#part type="text/html">');
        expect(text).toContain("<h1>Hello</h1>");
        expect(text).not.toContain('<#part type="text/plain">');
      });

      it("explicit html=true forces HTML wrapping even for non-HTML body", async () => {
        const tool = getToolHandler(server, "compose_email");
        const result = await tool.handler({
          to: "alice@example.com", subject: "Test", body: "Plain text",
          cc: undefined, bcc: undefined, html: true, attachments: undefined, confirm: undefined, account: undefined,
        }, {} as any);

        const text = result.content[0].text;
        expect(text).toContain('<#part type="text/html">');
      });

      it("plain text body without html flag has no part wrappers", async () => {
        const tool = getToolHandler(server, "compose_email");
        const result = await tool.handler({
          to: "alice@example.com", subject: "Test", body: "Just plain text",
          cc: undefined, bcc: undefined, attachments: undefined, confirm: undefined, account: undefined,
        }, {} as any);

        const text = result.content[0].text;
        expect(text).not.toContain("<#part type=");
      });

      it("sends HTML email when confirm=true", async () => {
        const tool = getToolHandler(server, "compose_email");
        const htmlBody = "<html><body><h1>Hi</h1></body></html>";
        await tool.handler({
          to: "alice@example.com", subject: "Test", body: htmlBody,
          cc: undefined, bcc: undefined, attachments: undefined, confirm: true, account: undefined,
        }, {} as any);

        expect(client.sendTemplate).toHaveBeenCalled();
        const [templateArg] = (client.sendTemplate as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(templateArg).toContain('<#part type="text/html">');
        expect(templateArg).not.toContain('<#part type="text/plain">');
      });
    });
  });
});
