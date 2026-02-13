import { describe, it, expect } from "vitest";
import {
  parse,
  parseEnvelopes,
  parseFolders,
  parseAccounts,
  parseMessageBody,
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
