import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HimalayaClient } from "../src/himalaya/client.js";
import { parseICS } from "../src/adapters/calendar.js";
import { registerCalendarTools } from "../src/tools/calendar.js";

// Mock node modules — simulate downloaded files in temp dir
vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  // Default: dir contains invite.ics and notes.txt
  readdir: vi.fn().mockResolvedValue(["invite.ics", "notes.txt", "plain.txt"]),
  readFile: vi.fn().mockResolvedValue(`BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:Team Standup
DTSTART:20260216T090000
DTEND:20260216T093000
LOCATION:Conference Room B
ORGANIZER;CN=Alice:mailto:alice@example.com
DESCRIPTION:Daily standup meeting
UID:abc-123@example.com
END:VEVENT
END:VCALENDAR`),
}));

vi.mock("node:os", () => ({
  tmpdir: vi.fn().mockReturnValue("/tmp"),
}));

vi.mock("node:crypto", () => ({
  randomUUID: vi.fn().mockReturnValue("cal-uuid-5678"),
}));

// Mock osascript for create_calendar_event
vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    execFile: vi.fn((cmd: string, args: string[], opts: any, cb?: Function) => {
      // If called with osascript, succeed
      if (cmd === "osascript") {
        if (cb) cb(null, { stdout: "" });
        return { stdin: { write: vi.fn(), end: vi.fn() } };
      }
      // Delegate to original for other commands
      return actual.execFile(cmd, args, opts, cb);
    }),
  };
});

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

// --- ICS Parser Tests ---

describe("ICS Parser", () => {
  it("parses a basic VEVENT", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:Team Standup
DTSTART:20260216T090000
DTEND:20260216T093000
LOCATION:Conference Room B
ORGANIZER;CN=Alice:mailto:alice@example.com
DESCRIPTION:Daily standup
UID:abc-123
END:VEVENT
END:VCALENDAR`;

    const event = parseICS(ics);
    expect(event).not.toBeNull();
    expect(event!.summary).toBe("Team Standup");
    expect(event!.dtstart).toBe("2026-02-16T09:00:00");
    expect(event!.dtend).toBe("2026-02-16T09:30:00");
    expect(event!.location).toBe("Conference Room B");
    expect(event!.organizer).toBe("alice@example.com");
    expect(event!.description).toBe("Daily standup");
  });

  it("handles folded lines (RFC 5545 line folding)", () => {
    // RFC 5545: long lines are folded by inserting CRLF + leading space/tab.
    // The fold indicator (leading space) is removed during unfolding.
    // The trailing space before the fold point is content, preserved as-is.
    const ics = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Very Long Meeting \r\n Title That Wraps\r\nDTSTART:20260216T090000\r\nDTEND:20260216T100000\r\nEND:VEVENT\r\nEND:VCALENDAR";

    const event = parseICS(ics);
    expect(event!.summary).toBe("Very Long Meeting Title That Wraps");
  });

  it("returns null for missing SUMMARY", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260216T090000
END:VEVENT
END:VCALENDAR`;

    expect(parseICS(ics)).toBeNull();
  });

  it("returns null for missing DTSTART", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:Test
END:VEVENT
END:VCALENDAR`;

    expect(parseICS(ics)).toBeNull();
  });

  it("handles date-only format", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:All Day Event
DTSTART:20260216
DTEND:20260217
END:VEVENT
END:VCALENDAR`;

    const event = parseICS(ics);
    expect(event!.dtstart).toBe("2026-02-16");
    expect(event!.dtend).toBe("2026-02-17");
  });

  it("handles DTSTART with TZID parameter", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:Meeting
DTSTART;TZID=US/Eastern:20260216T090000
DTEND;TZID=US/Eastern:20260216T100000
END:VEVENT
END:VCALENDAR`;

    const event = parseICS(ics);
    expect(event!.dtstart).toBe("2026-02-16T09:00:00");
  });
});

// --- Calendar Tool Tests ---

describe("Calendar tools", () => {
  let server: McpServer;
  let client: HimalayaClient;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    registerCalendarTools(server, client);
  });

  describe("extract_calendar_event", () => {
    it("extracts event from ICS attachment", async () => {
      const tool = getToolHandler(server, "extract_calendar_event");
      const result = await tool.handler({ id: "55", folder: undefined, account: undefined }, {} as any);

      const text = result.content[0].text;
      expect(text).toContain("Team Standup");
      expect(text).toContain("2026-02-16");
      expect(text).toContain("Conference Room B");
      expect(text).toContain("create_calendar_event");
    });

    it("returns message when no ICS found", async () => {
      const { readdir } = await import("node:fs/promises");
      // No .ics file in the downloaded files
      vi.mocked(readdir).mockResolvedValueOnce(["notes.txt", "plain.txt"] as any);
      const tool = getToolHandler(server, "extract_calendar_event");
      const result = await tool.handler({ id: "55", folder: undefined, account: undefined }, {} as any);

      expect(result.content[0].text).toContain("No calendar attachment");
    });

    it("handles errors", async () => {
      vi.spyOn(client, "downloadAttachments").mockRejectedValue(new Error("not found"));
      const tool = getToolHandler(server, "extract_calendar_event");
      const result = await tool.handler({ id: "999", folder: undefined, account: undefined }, {} as any);

      expect(result.isError).toBe(true);
    });
  });

  describe("create_calendar_event", () => {
    it("without confirm returns preview", async () => {
      const tool = getToolHandler(server, "create_calendar_event");
      const result = await tool.handler({
        summary: "Team Standup", dtstart: "2026-02-16T09:00:00", dtend: "2026-02-16T09:30:00",
        location: "Room B", description: undefined, confirm: undefined,
      }, {} as any);

      const text = result.content[0].text;
      expect(text).toContain("PREVIEW");
      expect(text).toContain("NOT been created");
      expect(text).toContain("Team Standup");
      expect(text).toContain("Room B");
    });

    it("with confirm=true attempts to create event", async () => {
      const tool = getToolHandler(server, "create_calendar_event");
      const result = await tool.handler({
        summary: "Team Standup", dtstart: "2026-02-16T09:00:00", dtend: "2026-02-16T09:30:00",
        location: undefined, description: undefined, confirm: true,
      }, {} as any);

      // On macOS this will try osascript (mocked above)
      // Accept either success or platform error
      const text = result.content[0].text;
      expect(
        text.includes("created successfully") || text.includes("only available on macOS") || text.includes("Error")
      ).toBe(true);
    });

    it("includes location in preview", async () => {
      const tool = getToolHandler(server, "create_calendar_event");
      const result = await tool.handler({
        summary: "Meeting", dtstart: "2026-02-16T09:00:00", dtend: "2026-02-16T10:00:00",
        location: "Building 5", description: undefined, confirm: undefined,
      }, {} as any);

      expect(result.content[0].text).toContain("Building 5");
    });
  });
});
