import { describe, it, expect } from "vitest";
import {
  parse,
  parseEnvelopes,
  parseFolders,
  parseAccounts,
  parseMessageBody,
  formatEnvelope,
} from "../src/himalaya/parser.js";

describe("parse (generic)", () => {
  it("parses valid JSON array", () => {
    const result = parse<number[]>("[1, 2, 3]");
    expect(result).toEqual({ ok: true, data: [1, 2, 3] });
  });

  it("parses valid JSON object", () => {
    const result = parse<{ name: string }>('{"name": "test"}');
    expect(result).toEqual({ ok: true, data: { name: "test" } });
  });

  it("returns error for empty string", () => {
    const result = parse("");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("EMPTY");
    }
  });

  it("returns error for whitespace-only string", () => {
    const result = parse("   \n  ");
    expect(result.ok).toBe(false);
  });

  it("returns error for malformed JSON", () => {
    const result = parse("not json at all");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PARSE_ERROR");
    }
  });
});

describe("parseEnvelopes", () => {
  const sampleEnvelope = JSON.stringify([{
    id: "12345",
    flags: ["Seen"],
    subject: "Test email",
    from: { name: "Sender", addr: "sender@example.com" },
    to: { name: null, addr: "me@example.com" },
    date: "2026-02-13 10:00",
    has_attachment: false,
  }]);

  it("parses valid envelope list", () => {
    const result = parseEnvelopes(sampleEnvelope);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe("12345");
      expect(result.data[0].from.addr).toBe("sender@example.com");
    }
  });

  it("parses empty envelope list", () => {
    const result = parseEnvelopes("[]");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(0);
    }
  });

  it("unwraps v2 envelope wrapper and normalizes field shapes", () => {
    const result = parseEnvelopes(JSON.stringify({
      envelopes: [{
        id: "249574",
        flags: [{ raw: "\\Seen", iana: "seen" }, { raw: "\\Flagged", iana: "flagged" }],
        subject: "Re: Stat Faculty get together",
        from: [{ name: "Ronald Christensen", email: "rchriste@unm.edu" }],
        to: [{ name: "Erik Erhardt", email: "erike@stat.unm.edu" }],
        date: "2026-02-18T22:30:36Z",
        size: 46219,
        "has-attachment": null,
      }],
    }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      const e = result.data[0];
      expect(e.id).toBe("249574");
      expect(e.flags).toEqual(["Seen", "Flagged"]);
      expect(e.from).toEqual({ name: "Ronald Christensen", addr: "rchriste@unm.edu" });
      expect(e.to).toEqual({ name: "Erik Erhardt", addr: "erike@stat.unm.edu" });
      expect(e.date).toBe("2026-02-18T22:30:36Z");
      expect(e.has_attachment).toBe(false);
    }
  });

  it("normalizes v2 has-attachment true and empty from array", () => {
    const result = parseEnvelopes(JSON.stringify({
      envelopes: [{
        id: "1",
        flags: [],
        subject: "No sender",
        from: [],
        to: [],
        date: "2026-03-01T00:00:00Z",
        "has-attachment": true,
      }],
    }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0].from).toEqual({ name: null, addr: "" });
      expect(result.data[0].to).toEqual({ name: null, addr: "" });
      expect(result.data[0].has_attachment).toBe(true);
      expect(result.data[0].flags).toEqual([]);
    }
  });

  it("unwraps v2 empty envelope wrapper", () => {
    const result = parseEnvelopes(JSON.stringify({ envelopes: [] }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(0);
    }
  });

  it("renders a v2-normalized envelope via formatEnvelope", () => {
    const result = parseEnvelopes(JSON.stringify({
      envelopes: [{
        id: "249574",
        flags: [{ raw: "\\Seen", iana: "seen" }, { raw: "\\Flagged", iana: "flagged" }],
        subject: "Re: Stat Faculty get together",
        from: [{ name: "Ronald Christensen", email: "rchriste@unm.edu" }],
        to: [{ name: "Erik Erhardt", email: "erike@stat.unm.edu" }],
        date: "2026-02-18T22:30:36Z",
        "has-attachment": null,
      }],
    }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const line = formatEnvelope(result.data[0]);
      expect(line).toContain("249574");
      expect(line).toContain("Ronald Christensen");
      expect(line).toContain("Re: Stat Faculty get together");
      expect(line).toContain("[Seen, Flagged]");
      expect(line).not.toContain("undefined");
      expect(line).not.toContain("[object Object]");
    }
  });
});

describe("parseFolders", () => {
  const sampleFolders = JSON.stringify([
    { name: "INBOX", desc: "\\Marked, \\HasNoChildren" },
    { name: "Drafts", desc: "\\HasNoChildren, \\Drafts" },
  ]);

  it("parses valid folder list", () => {
    const result = parseFolders(sampleFolders);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(2);
      expect(result.data[0].name).toBe("INBOX");
    }
  });

  it("unwraps v2 mailbox wrapper and fills missing desc", () => {
    const result = parseFolders(JSON.stringify({
      mailboxes: [
        { id: "admin", name: "admin", total: null, unread: null },
        { id: "Archive", name: "Archive", total: 3, unread: 0 },
      ],
    }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({ name: "admin", desc: "" });
      expect(result.data[1]).toEqual({ name: "Archive", desc: "" });
    }
  });

  it("unwraps v2 empty mailbox wrapper", () => {
    const result = parseFolders(JSON.stringify({ mailboxes: [] }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(0);
    }
  });
});

describe("parseAccounts", () => {
  const sampleAccounts = JSON.stringify([
    { name: "unm", backend: "IMAP, SMTP", default: true },
  ]);

  it("parses valid account list", () => {
    const result = parseAccounts(sampleAccounts);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe("unm");
      expect(result.data[0].default).toBe(true);
    }
  });
});

describe("parseMessageBody", () => {
  it("parses JSON-quoted string body", () => {
    const result = parseMessageBody('"Hello world\\n\\nThis is the body"');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe("Hello world\n\nThis is the body");
    }
  });

  it("parses empty quoted string", () => {
    const result = parseMessageBody('""');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe("");
    }
  });

  it("returns error for empty input", () => {
    const result = parseMessageBody("");
    expect(result.ok).toBe(false);
  });

  it("falls back to raw text for non-JSON", () => {
    const result = parseMessageBody("raw text body");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe("raw text body");
    }
  });
});
