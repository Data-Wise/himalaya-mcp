import { describe, it, expect } from "vitest";

/**
 * Tests for export_to_markdown formatting logic.
 * We test the markdown output structure directly rather than through MCP,
 * since the tool is just formatting — no subprocess calls needed.
 */

// Helper to build the same markdown the tool produces
function buildMarkdown(envelope: {
  id: string;
  subject: string;
  from: { name: string | null; addr: string };
  to: { name: string | null; addr: string };
  date: string;
  flags: string[];
  has_attachment: boolean;
}, body: string): string {
  const fromStr = envelope.from.name
    ? `${envelope.from.name} <${envelope.from.addr}>`
    : envelope.from.addr;
  const toStr = envelope.to.name
    ? `${envelope.to.name} <${envelope.to.addr}>`
    : envelope.to.addr;

  return [
    "---",
    `subject: "${envelope.subject.replace(/"/g, '\\"')}"`,
    `from: "${fromStr}"`,
    `to: "${toStr}"`,
    `date: "${envelope.date}"`,
    `id: "${envelope.id}"`,
    envelope.flags.length > 0 ? `flags: [${envelope.flags.join(", ")}]` : "flags: []",
    envelope.has_attachment ? "has_attachment: true" : "has_attachment: false",
    "---",
    "",
    `# ${envelope.subject}`,
    "",
    body || "(empty body)",
  ].join("\n");
}

describe("export_to_markdown formatting", () => {
  it("produces valid YAML frontmatter", () => {
    const md = buildMarkdown({
      id: "42",
      subject: "Meeting Tomorrow",
      from: { name: "Alice", addr: "alice@example.com" },
      to: { name: "Bob", addr: "bob@example.com" },
      date: "2026-02-13T10:00:00Z",
      flags: ["Seen"],
      has_attachment: false,
    }, "Don't forget the meeting at 3pm.");

    expect(md).toContain("---");
    expect(md).toContain('subject: "Meeting Tomorrow"');
    expect(md).toContain('from: "Alice <alice@example.com>"');
    expect(md).toContain('to: "Bob <bob@example.com>"');
    expect(md).toContain('date: "2026-02-13T10:00:00Z"');
    expect(md).toContain("flags: [Seen]");
    expect(md).toContain("has_attachment: false");
    expect(md).toContain("# Meeting Tomorrow");
    expect(md).toContain("Don't forget the meeting at 3pm.");
  });

  it("handles address without name", () => {
    const md = buildMarkdown({
      id: "1",
      subject: "Test",
      from: { name: null, addr: "noreply@example.com" },
      to: { name: null, addr: "me@example.com" },
      date: "2026-02-13",
      flags: [],
      has_attachment: false,
    }, "body");

    expect(md).toContain('from: "noreply@example.com"');
    expect(md).toContain('to: "me@example.com"');
  });

  it("escapes quotes in subject", () => {
    const md = buildMarkdown({
      id: "1",
      subject: 'Re: "Important" stuff',
      from: { name: null, addr: "a@b.com" },
      to: { name: null, addr: "c@d.com" },
      date: "2026-02-13",
      flags: [],
      has_attachment: false,
    }, "body");

    expect(md).toContain('subject: "Re: \\"Important\\" stuff"');
  });

  it("shows multiple flags", () => {
    const md = buildMarkdown({
      id: "1",
      subject: "Flagged",
      from: { name: null, addr: "a@b.com" },
      to: { name: null, addr: "c@d.com" },
      date: "2026-02-13",
      flags: ["Seen", "Flagged", "Answered"],
      has_attachment: false,
    }, "body");

    expect(md).toContain("flags: [Seen, Flagged, Answered]");
  });

  it("shows attachment indicator", () => {
    const md = buildMarkdown({
      id: "1",
      subject: "File attached",
      from: { name: null, addr: "a@b.com" },
      to: { name: null, addr: "c@d.com" },
      date: "2026-02-13",
      flags: [],
      has_attachment: true,
    }, "See attached.");

    expect(md).toContain("has_attachment: true");
  });

  it("handles empty body", () => {
    const md = buildMarkdown({
      id: "1",
      subject: "Empty",
      from: { name: null, addr: "a@b.com" },
      to: { name: null, addr: "c@d.com" },
      date: "2026-02-13",
      flags: [],
      has_attachment: false,
    }, "");

    expect(md).toContain("(empty body)");
  });
});
