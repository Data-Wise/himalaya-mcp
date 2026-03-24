import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerMorningPrompt } from "../src/prompts/morning.js";
import { registerInboxCheckPrompt } from "../src/prompts/inbox-check.js";

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

describe("Morning & Inbox Check Prompts", () => {
  describe("morning_briefing", () => {
    it("registers with correct name and description", () => {
      const { server, prompts } = createMockServer();
      registerMorningPrompt(server);

      expect(prompts.has("morning_briefing")).toBe(true);
      const { config } = prompts.get("morning_briefing")!;
      expect(config.description).toContain("morning");
      expect(config.title).toBe("Morning Briefing");
    });

    it("returns messages with no account specified", async () => {
      const { server, prompts } = createMockServer();
      registerMorningPrompt(server);

      const { cb } = prompts.get("morning_briefing")!;
      const result = await cb({ account: undefined });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe("user");
      expect(result.messages[0].content.type).toBe("text");
    });

    it("includes account when specified", async () => {
      const { server, prompts } = createMockServer();
      registerMorningPrompt(server);

      const { cb } = prompts.get("morning_briefing")!;
      const result = await cb({ account: "work" });

      const text = result.messages[0].content.text;
      expect(text).toContain("work");
      expect(text).toContain('account: "work"');
    });

    it("mentions list_emails and read_email tools", async () => {
      const { server, prompts } = createMockServer();
      registerMorningPrompt(server);

      const { cb } = prompts.get("morning_briefing")!;
      const result = await cb({ account: undefined });
      const text = result.messages[0].content.text;

      expect(text).toContain("list_emails");
      expect(text).toContain("read_email");
    });

    it("mentions extract_calendar_event for calendar invites", async () => {
      const { server, prompts } = createMockServer();
      registerMorningPrompt(server);

      const { cb } = prompts.get("morning_briefing")!;
      const result = await cb({ account: undefined });
      const text = result.messages[0].content.text;

      expect(text).toContain("extract_calendar_event");
    });

    it("classifies emails by urgency categories", async () => {
      const { server, prompts } = createMockServer();
      registerMorningPrompt(server);

      const { cb } = prompts.get("morning_briefing")!;
      const result = await cb({ account: undefined });
      const text = result.messages[0].content.text;

      expect(text).toContain("Needs Reply Today");
      expect(text).toContain("FYI");
      expect(text).toContain("Newsletter");
      expect(text).toContain("Automated");
    });

    it("mentions export_to_markdown for saving briefing", async () => {
      const { server, prompts } = createMockServer();
      registerMorningPrompt(server);

      const { cb } = prompts.get("morning_briefing")!;
      const result = await cb({ account: undefined });
      const text = result.messages[0].content.text;

      expect(text).toContain("export_to_markdown");
    });
  });

  describe("inbox_check", () => {
    it("registers with correct name and description", () => {
      const { server, prompts } = createMockServer();
      registerInboxCheckPrompt(server);

      expect(prompts.has("inbox_check")).toBe(true);
      const { config } = prompts.get("inbox_check")!;
      expect(config.description).toContain("inbox");
      expect(config.title).toBe("Inbox Check");
    });

    it("returns messages with defaults (no args)", async () => {
      const { server, prompts } = createMockServer();
      registerInboxCheckPrompt(server);

      const { cb } = prompts.get("inbox_check")!;
      const result = await cb({ account: undefined, folder: undefined });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe("user");
      expect(result.messages[0].content.text).toContain("INBOX");
    });

    it("uses custom folder when specified", async () => {
      const { server, prompts } = createMockServer();
      registerInboxCheckPrompt(server);

      const { cb } = prompts.get("inbox_check")!;
      const result = await cb({ account: undefined, folder: "Sent" });

      const text = result.messages[0].content.text;
      expect(text).toContain("Sent");
    });

    it("includes account when specified", async () => {
      const { server, prompts } = createMockServer();
      registerInboxCheckPrompt(server);

      const { cb } = prompts.get("inbox_check")!;
      const result = await cb({ account: "personal", folder: undefined });

      const text = result.messages[0].content.text;
      expect(text).toContain("personal");
    });

    it("mentions list_emails tool", async () => {
      const { server, prompts } = createMockServer();
      registerInboxCheckPrompt(server);

      const { cb } = prompts.get("inbox_check")!;
      const result = await cb({ account: undefined, folder: undefined });
      const text = result.messages[0].content.text;

      expect(text).toContain("list_emails");
    });

    it("suggests next actions", async () => {
      const { server, prompts } = createMockServer();
      registerInboxCheckPrompt(server);

      const { cb } = prompts.get("inbox_check")!;
      const result = await cb({ account: undefined, folder: undefined });
      const text = result.messages[0].content.text;

      expect(text).toContain("Triage");
      expect(text).toContain("Reply");
      expect(text).toContain("morning briefing");
    });
  });
});
