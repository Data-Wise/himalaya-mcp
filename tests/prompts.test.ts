import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTriagePrompt } from "../src/prompts/triage.js";
import { registerSummarizePrompt } from "../src/prompts/summarize.js";
import { registerDigestPrompt } from "../src/prompts/digest.js";
import { registerReplyPrompt } from "../src/prompts/reply.js";

// Spy on registerPrompt to verify registration without running a full server
function createMockServer() {
  const prompts = new Map<string, { config: any; cb: Function }>();
  const server = {
    registerPrompt: vi.fn((name: string, config: any, cb: Function) => {
      prompts.set(name, { config, cb });
    }),
  } as unknown as McpServer;
  return { server, prompts };
}

describe("MCP Prompts", () => {
  describe("triage_inbox", () => {
    it("registers with correct name and description", () => {
      const { server, prompts } = createMockServer();
      registerTriagePrompt(server);

      expect(prompts.has("triage_inbox")).toBe(true);
      const { config } = prompts.get("triage_inbox")!;
      expect(config.description).toContain("Classify");
    });

    it("returns messages with default count", async () => {
      const { server, prompts } = createMockServer();
      registerTriagePrompt(server);

      const { cb } = prompts.get("triage_inbox")!;
      const result = await cb({ count: undefined });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe("user");
      expect(result.messages[0].content.text).toContain("10");
    });

    it("uses custom count", async () => {
      const { server, prompts } = createMockServer();
      registerTriagePrompt(server);

      const { cb } = prompts.get("triage_inbox")!;
      const result = await cb({ count: "25" });

      expect(result.messages[0].content.text).toContain("25");
    });

    it("mentions list_emails and read_email tools", async () => {
      const { server, prompts } = createMockServer();
      registerTriagePrompt(server);

      const { cb } = prompts.get("triage_inbox")!;
      const result = await cb({ count: undefined });
      const text = result.messages[0].content.text;

      expect(text).toContain("list_emails");
      expect(text).toContain("read_email");
    });
  });

  describe("summarize_email", () => {
    it("registers with correct name", () => {
      const { server, prompts } = createMockServer();
      registerSummarizePrompt(server);

      expect(prompts.has("summarize_email")).toBe(true);
    });

    it("includes email ID in prompt", async () => {
      const { server, prompts } = createMockServer();
      registerSummarizePrompt(server);

      const { cb } = prompts.get("summarize_email")!;
      const result = await cb({ id: "42", folder: undefined });

      expect(result.messages[0].content.text).toContain("42");
      expect(result.messages[0].content.text).toContain("read_email");
    });

    it("includes folder when specified", async () => {
      const { server, prompts } = createMockServer();
      registerSummarizePrompt(server);

      const { cb } = prompts.get("summarize_email")!;
      const result = await cb({ id: "42", folder: "Sent Items" });

      expect(result.messages[0].content.text).toContain("Sent Items");
    });
  });

  describe("daily_email_digest", () => {
    it("registers with correct name", () => {
      const { server, prompts } = createMockServer();
      registerDigestPrompt(server);

      expect(prompts.has("daily_email_digest")).toBe(true);
    });

    it("returns messages with no required args", async () => {
      const { server, prompts } = createMockServer();
      registerDigestPrompt(server);

      const { cb } = prompts.get("daily_email_digest")!;
      const result = await cb({});

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content.text).toContain("list_emails");
      expect(result.messages[0].content.text).toContain("priority");
    });

    it("mentions export_to_markdown tool", async () => {
      const { server, prompts } = createMockServer();
      registerDigestPrompt(server);

      const { cb } = prompts.get("daily_email_digest")!;
      const result = await cb({});

      expect(result.messages[0].content.text).toContain("export_to_markdown");
    });
  });

  describe("draft_reply", () => {
    it("registers with correct name", () => {
      const { server, prompts } = createMockServer();
      registerReplyPrompt(server);

      expect(prompts.has("draft_reply")).toBe(true);
      const { config } = prompts.get("draft_reply")!;
      expect(config.description).toContain("reply");
    });

    it("includes email ID in prompt", async () => {
      const { server, prompts } = createMockServer();
      registerReplyPrompt(server);

      const { cb } = prompts.get("draft_reply")!;
      const result = await cb({ id: "42", tone: undefined, instructions: undefined });

      const text = result.messages[0].content.text;
      expect(text).toContain("42");
      expect(text).toContain("read_email");
      expect(text).toContain("draft_reply");
    });

    it("uses custom tone", async () => {
      const { server, prompts } = createMockServer();
      registerReplyPrompt(server);

      const { cb } = prompts.get("draft_reply")!;
      const result = await cb({ id: "42", tone: "casual", instructions: undefined });

      expect(result.messages[0].content.text).toContain("casual");
    });

    it("includes specific instructions", async () => {
      const { server, prompts } = createMockServer();
      registerReplyPrompt(server);

      const { cb } = prompts.get("draft_reply")!;
      const result = await cb({ id: "42", tone: undefined, instructions: "Decline the meeting politely" });

      expect(result.messages[0].content.text).toContain("Decline the meeting politely");
    });

    it("emphasizes safety — never send without approval", async () => {
      const { server, prompts } = createMockServer();
      registerReplyPrompt(server);

      const { cb } = prompts.get("draft_reply")!;
      const result = await cb({ id: "42", tone: undefined, instructions: undefined });

      const text = result.messages[0].content.text;
      expect(text).toContain("confirm=true");
      expect(text).toContain("approval");
    });
  });
});
