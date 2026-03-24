import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { normalizeSubject, groupIntoThreads, formatThread } from "../src/himalaya/thread-parser.js";
import type { Envelope, Thread } from "../src/himalaya/types.js";

// --- normalizeSubject tests ---

describe("normalizeSubject", () => {
  it("strips Re: prefix", () => {
    expect(normalizeSubject("Re: Meeting tomorrow")).toBe("Meeting tomorrow");
  });

  it("strips Fwd: prefix", () => {
    expect(normalizeSubject("Fwd: Meeting tomorrow")).toBe("Meeting tomorrow");
  });

  it("strips RE: prefix (uppercase)", () => {
    expect(normalizeSubject("RE: Meeting tomorrow")).toBe("Meeting tomorrow");
  });

  it("strips FW: prefix", () => {
    expect(normalizeSubject("FW: Meeting tomorrow")).toBe("Meeting tomorrow");
  });

  it("strips nested Re: Re: prefixes", () => {
    expect(normalizeSubject("Re: Re: Meeting tomorrow")).toBe("Meeting tomorrow");
  });

  it("strips mixed Re: Fwd: prefixes", () => {
    expect(normalizeSubject("Re: Fwd: Re: Meeting tomorrow")).toBe("Meeting tomorrow");
  });

  it("strips Re[2]: style prefix", () => {
    expect(normalizeSubject("Re[2]: Meeting tomorrow")).toBe("Meeting tomorrow");
  });

  it("preserves clean subjects", () => {
    expect(normalizeSubject("Meeting tomorrow")).toBe("Meeting tomorrow");
  });

  it("handles empty string", () => {
    expect(normalizeSubject("")).toBe("");
  });

  it("handles whitespace-only subject", () => {
    expect(normalizeSubject("   ")).toBe("");
  });

  it("handles subject that is just Re:", () => {
    expect(normalizeSubject("Re:")).toBe("");
  });
});

// --- Helper to make test envelopes ---

function makeEnvelope(overrides: Partial<Envelope> & { id: string }): Envelope {
  return {
    id: overrides.id,
    flags: overrides.flags ?? [],
    subject: overrides.subject ?? "Test subject",
    from: overrides.from ?? { name: "Test User", addr: "test@example.com" },
    to: overrides.to ?? { name: null, addr: "me@example.com" },
    date: overrides.date ?? "2026-03-17 10:00",
    has_attachment: overrides.has_attachment ?? false,
  };
}

// --- groupIntoThreads tests ---

describe("groupIntoThreads", () => {
  it("returns empty array for empty input", () => {
    expect(groupIntoThreads([])).toEqual([]);
  });

  it("groups single message as single thread", () => {
    const envelopes = [makeEnvelope({ id: "1", subject: "Hello" })];
    const threads = groupIntoThreads(envelopes);
    expect(threads).toHaveLength(1);
    expect(threads[0].message_count).toBe(1);
    expect(threads[0].thread_id).toBe("1");
  });

  it("groups reply chain into one thread", () => {
    const envelopes = [
      makeEnvelope({ id: "1", subject: "Meeting", date: "2026-03-17 09:00" }),
      makeEnvelope({ id: "2", subject: "Re: Meeting", date: "2026-03-17 10:00" }),
      makeEnvelope({ id: "3", subject: "Re: Re: Meeting", date: "2026-03-17 11:00" }),
    ];
    const threads = groupIntoThreads(envelopes);
    expect(threads).toHaveLength(1);
    expect(threads[0].message_count).toBe(3);
  });

  it("separates unrelated subjects into different threads", () => {
    const envelopes = [
      makeEnvelope({ id: "1", subject: "Meeting" }),
      makeEnvelope({ id: "2", subject: "Invoice" }),
    ];
    const threads = groupIntoThreads(envelopes);
    expect(threads).toHaveLength(2);
  });

  it("uses first message ID as thread_id", () => {
    const envelopes = [
      makeEnvelope({ id: "5", subject: "Discussion", date: "2026-03-17 09:00" }),
      makeEnvelope({ id: "3", subject: "Re: Discussion", date: "2026-03-17 10:00" }),
    ];
    const threads = groupIntoThreads(envelopes);
    expect(threads[0].thread_id).toBe("5");
  });

  it("sorts messages chronologically within a thread", () => {
    const envelopes = [
      makeEnvelope({ id: "2", subject: "Re: Chat", date: "2026-03-17 11:00" }),
      makeEnvelope({ id: "1", subject: "Chat", date: "2026-03-17 09:00" }),
    ];
    const threads = groupIntoThreads(envelopes);
    expect(threads[0].messages[0].id).toBe("1");
    expect(threads[0].messages[1].id).toBe("2");
  });

  it("sorts threads by latest_date descending", () => {
    const envelopes = [
      makeEnvelope({ id: "1", subject: "Old thread", date: "2026-03-15 10:00" }),
      makeEnvelope({ id: "2", subject: "New thread", date: "2026-03-17 10:00" }),
    ];
    const threads = groupIntoThreads(envelopes);
    expect(threads[0].subject).toBe("New thread");
    expect(threads[1].subject).toBe("Old thread");
  });

  it("collects unique participants", () => {
    const envelopes = [
      makeEnvelope({
        id: "1",
        subject: "Chat",
        from: { name: "Alice", addr: "alice@example.com" },
        date: "2026-03-17 09:00",
      }),
      makeEnvelope({
        id: "2",
        subject: "Re: Chat",
        from: { name: "Bob", addr: "bob@example.com" },
        date: "2026-03-17 10:00",
      }),
      makeEnvelope({
        id: "3",
        subject: "Re: Chat",
        from: { name: "Alice", addr: "alice@example.com" },
        date: "2026-03-17 11:00",
      }),
    ];
    const threads = groupIntoThreads(envelopes);
    expect(threads[0].participants).toHaveLength(2);
  });

  it("detects unread threads", () => {
    const envelopes = [
      makeEnvelope({ id: "1", subject: "Read", flags: ["Seen"] }),
      makeEnvelope({ id: "2", subject: "Unread", flags: [] }),
    ];
    const threads = groupIntoThreads(envelopes);
    const readThread = threads.find((t) => t.subject === "Read");
    const unreadThread = threads.find((t) => t.subject === "Unread");
    expect(readThread!.has_unread).toBe(false);
    expect(unreadThread!.has_unread).toBe(true);
  });

  it("handles mixed case subjects for grouping", () => {
    const envelopes = [
      makeEnvelope({ id: "1", subject: "MEETING notes", date: "2026-03-17 09:00" }),
      makeEnvelope({ id: "2", subject: "Re: Meeting Notes", date: "2026-03-17 10:00" }),
    ];
    const threads = groupIntoThreads(envelopes);
    expect(threads).toHaveLength(1);
    expect(threads[0].message_count).toBe(2);
  });

  it("handles Fwd: in subject grouping", () => {
    const envelopes = [
      makeEnvelope({ id: "1", subject: "Report", date: "2026-03-17 09:00" }),
      makeEnvelope({ id: "2", subject: "Fwd: Report", date: "2026-03-17 10:00" }),
    ];
    const threads = groupIntoThreads(envelopes);
    expect(threads).toHaveLength(1);
  });

  it("sets earliest_date and latest_date correctly", () => {
    const envelopes = [
      makeEnvelope({ id: "1", subject: "Topic", date: "2026-03-15 09:00" }),
      makeEnvelope({ id: "2", subject: "Re: Topic", date: "2026-03-17 15:00" }),
    ];
    const threads = groupIntoThreads(envelopes);
    expect(threads[0].earliest_date).toBe("2026-03-15 09:00");
    expect(threads[0].latest_date).toBe("2026-03-17 15:00");
  });
});

// --- formatThread tests ---

describe("formatThread", () => {
  it("formats single-message thread", () => {
    const thread: Thread = {
      thread_id: "42",
      subject: "Hello",
      message_count: 1,
      participants: [{ name: "Alice", addr: "alice@example.com" }],
      latest_date: "2026-03-17 10:00",
      earliest_date: "2026-03-17 10:00",
      messages: [],
      has_unread: false,
    };
    const formatted = formatThread(thread);
    expect(formatted).toContain("42");
    expect(formatted).toContain("Alice");
    expect(formatted).toContain("Hello");
    expect(formatted).not.toContain("messages");
  });

  it("formats multi-message thread with count", () => {
    const thread: Thread = {
      thread_id: "42",
      subject: "Discussion",
      message_count: 5,
      participants: [
        { name: "Alice", addr: "alice@example.com" },
        { name: "Bob", addr: "bob@example.com" },
      ],
      latest_date: "2026-03-17 10:00",
      earliest_date: "2026-03-15 09:00",
      messages: [],
      has_unread: true,
    };
    const formatted = formatThread(thread);
    expect(formatted).toContain("(5 messages)");
    expect(formatted).toContain("[unread]");
    expect(formatted).toContain("Alice, Bob");
  });

  it("uses addr when name is null", () => {
    const thread: Thread = {
      thread_id: "1",
      subject: "Test",
      message_count: 1,
      participants: [{ name: null, addr: "anon@example.com" }],
      latest_date: "2026-03-17 10:00",
      earliest_date: "2026-03-17 10:00",
      messages: [],
      has_unread: false,
    };
    const formatted = formatThread(thread);
    expect(formatted).toContain("anon@example.com");
  });
});

// --- Tool registration tests ---

describe("Thread MCP tools", () => {
  function createMockServer() {
    const tools = new Map<string, { config: any; cb: Function }>();
    const server = {
      registerTool: vi.fn((name: string, config: any, cb: Function) => {
        tools.set(name, { config, cb });
      }),
    } as unknown as McpServer;
    return { server, tools };
  }

  it("registers list_threads tool", async () => {
    const { server, tools } = createMockServer();
    const { registerThreadTools } = await import("../src/tools/threads.js");
    const mockClient = {} as any;
    registerThreadTools(server, mockClient);
    expect(tools.has("list_threads")).toBe(true);
  });

  it("registers read_thread tool", async () => {
    const { server, tools } = createMockServer();
    const { registerThreadTools } = await import("../src/tools/threads.js");
    const mockClient = {} as any;
    registerThreadTools(server, mockClient);
    expect(tools.has("read_thread")).toBe(true);
  });

  it("list_threads has correct description", async () => {
    const { server, tools } = createMockServer();
    const { registerThreadTools } = await import("../src/tools/threads.js");
    registerThreadTools(server, {} as any);
    const config = tools.get("list_threads")!.config;
    expect(config.description).toContain("thread");
    expect(config.description).toContain("conversation");
  });

  it("read_thread has correct description", async () => {
    const { server, tools } = createMockServer();
    const { registerThreadTools } = await import("../src/tools/threads.js");
    registerThreadTools(server, {} as any);
    const config = tools.get("read_thread")!.config;
    expect(config.description).toContain("thread");
    expect(config.description).toContain("chronological");
  });
});
