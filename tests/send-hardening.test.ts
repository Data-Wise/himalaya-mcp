import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HimalayaClient } from "../src/himalaya/client.js";
import { registerComposeTools } from "../src/tools/compose.js";
import {
  buildMessage, cleanHeaderValue, parseMessage, renderForReview, renderOutgoing, templateToMessage,
} from "../src/himalaya/message.js";

const enc = (s: string) => "=?utf-8?B?" + Buffer.from(s).toString("base64") + "?=";

describe("cleanHeaderValue", () => {
  it("turns CR, LF, NUL, DEL and Unicode line separators into spaces", () => {
    expect(cleanHeaderValue("Hi\r\nBcc: evil@x.test")).toBe("Hi Bcc: evil@x.test");
    expect(cleanHeaderValue("a b c\u0085d\u0000e\u007ff")).toBe("a b c d e f");
    expect(cleanHeaderValue("  plain  ")).toBe("plain");
  });
});

describe("renderForReview / renderOutgoing never emit a smuggled header line", () => {
  it("keeps a CRLF in subject/threading values on one line", () => {
    const email = {
      from: { name: "", address: "a@x.test" }, to: [{ name: "", address: "b@x.test" }],
      subject: "Hi\r\nBcc: attacker@evil.test", inReplyTo: "<1@x>\r\nBcc: z@evil.test",
      references: "<1@x>\nCc: q@evil.test", text: "body",
    } as unknown as Parameters<typeof renderForReview>[0];
    const out = renderForReview(email);
    const headerBlock = out.split("\n\n")[0].split("\n");
    expect(headerBlock.filter((l) => /^(Bcc|Cc):/i.test(l))).toEqual([]);
    expect(headerBlock.filter((l) => /^Subject:/.test(l))).toHaveLength(1);
  });

  it("renderOutgoing sanitizes every header value", () => {
    const out = renderOutgoing({
      from: "me@x.test", to: "you@x.test", subject: "s\r\nBcc: evil@x.test", text: "body",
      inReplyTo: "<1@x>\r\nX: y",
    });
    expect(out.split("\n\n")[0].split("\n").some((l) => /^(Bcc|X):/.test(l))).toBe(false);
  });
});

describe("display names with a trailing backslash no longer garble the recipient", () => {
  it("builds a message whose recipient reparses as the real address (was <\"x\\\" real\"@x.test>)", async () => {
    const raw = `From: me@example.com\r\nTo: ${enc("x\\")} <real@x.test>\r\nSubject: s\r\n\r\nb\r\n`;
    const m = await templateToMessage(raw, { from: "me@example.com" });
    const reparsed = await parseMessage(await buildMessage(m));
    expect(reparsed.to?.map((a) => a.address)).toEqual(["real@x.test"]);
  });

  it("keeps a comma/angle-bracket display name as one recipient", async () => {
    const raw = `From: me@example.com\r\nTo: ${enc("a@x.test>, evil@evil.test, <b")} <real@x.test>\r\nSubject: s\r\n\r\nb\r\n`;
    const m = await templateToMessage(raw, { from: "me@example.com" });
    const reparsed = await parseMessage(await buildMessage(m));
    expect(reparsed.to?.map((a) => a.address)).toEqual(["real@x.test"]);
  });
});

describe("send_email preview shows what is sent (v2)", () => {
  let dir: string;
  let server: McpServer;
  let client: HimalayaClient;
  const env = { ...process.env };
  const send = (args: Record<string, unknown>) =>
    ((server as any)._registeredTools["send_email"].handler as (a: any, e: any) => Promise<any>)(args, {});

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "send-hardening-"));
    writeFileSync(join(dir, "config.toml"), '[accounts.work]\ndefault = true\nemail = "me@example.com"\n');
    process.env["HIMALAYA_CONFIG"] = join(dir, "config.toml");
    delete process.env["HIMALAYA_FROM"];
    client = new HimalayaClient({ from: "me@example.com", account: "work" });
    vi.spyOn(client, "resolveVersion").mockResolvedValue({ major: 2, raw: "himalaya v2.1.0" });
    vi.spyOn(client, "sendRaw").mockResolvedValue('{"sent":true}');
    server = new McpServer({ name: "test", version: "0" });
    registerComposeTools(server, client);
  });
  afterEach(() => { process.env = { ...env }; rmSync(dir, { recursive: true, force: true }); });

  it("previews decoded recipients incl. an encoded-word Bcc, and sends exactly those", async () => {
    const template = `To: you@x.test\r\nBcc: ${enc("Hidden")} <hidden@x.test>\r\nSubject: s\r\n\r\nbody`;
    const preview = (await send({ template, confirm: false })).content[0].text as string;
    expect(preview).toContain('Bcc: "Hidden" <hidden@x.test>');
    expect(preview).not.toContain("=?utf-8?");

    await send({ template, confirm: true });
    const sent = await parseMessage(vi.mocked(client.sendRaw).mock.calls[0][0]);
    const previewed = ["you@x.test", "hidden@x.test"];
    expect([...(sent.to ?? []), ...(sent.bcc ?? [])].map((a) => a.address)).toEqual(previewed);
  });

  it("rejects a template with no recipient at preview time, not only at send", async () => {
    const r = await send({ template: "Subject: s\r\n\r\nbody", confirm: false });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain("no To: recipient");
    expect(client.sendRaw).not.toHaveBeenCalled();
  });
});
