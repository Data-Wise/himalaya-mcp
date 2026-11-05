import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HimalayaClient } from "../src/himalaya/client.js";
import { registerComposeNewTools } from "../src/tools/compose-new.js";
import { registerComposeTools, replyAllCc } from "../src/tools/compose.js";
import { parseMessage } from "../src/himalaya/message.js";

function handler(server: McpServer, name: string) {
  const tool = (server as any)._registeredTools?.[name];
  if (!tool) throw new Error(`Tool "${name}" not registered`);
  return tool.handler as (args: any, extra: any) => Promise<any>;
}

describe("compose tools on himalaya v2", () => {
  let dir: string;
  let server: McpServer;
  let client: HimalayaClient;
  const env = { ...process.env };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "compose-v2-"));
    // Hermetic: never read the developer's own himalaya config.
    writeFileSync(join(dir, "config.toml"), '[accounts.work]\ndefault = true\nemail = "me@example.com"\ndisplay-name = "Me Myself"\n');
    process.env["HIMALAYA_CONFIG"] = join(dir, "config.toml");
    delete process.env["HIMALAYA_FROM"];
    client = new HimalayaClient({ from: "me@example.com", account: "work" });
    vi.spyOn(client, "resolveVersion").mockResolvedValue({ major: 2, raw: "himalaya v2.1.0" });
    vi.spyOn(client, "sendRaw").mockResolvedValue('{"sent":true}');
    vi.spyOn(client, "addRaw").mockResolvedValue("53580");
    vi.spyOn(client, "sendTemplate").mockRejectedValue(new Error("must not be called on v2"));
    server = new McpServer({ name: "test", version: "0" });
    registerComposeNewTools(server, client);
    registerComposeTools(server, client);
  });

  afterEach(() => {
    process.env = { ...env };
    rmSync(dir, { recursive: true, force: true });
  });

  const composeArgs = (extra: Record<string, unknown> = {}) => ({
    to: "you@example.com", subject: "Proposta", body: "In allegato il CV",
    cc: undefined, bcc: undefined, attachments: undefined, confirm: undefined,
    account: undefined, save_draft: undefined, drafts_folder: undefined, ...extra,
  });

  it("save_draft appends a full message with \\Draft and \\Seen set on the APPEND", async () => {
    const pdf = join(dir, "cv.pdf");
    writeFileSync(pdf, "%PDF-1.4");
    const result = await handler(server, "compose_email")(composeArgs({ save_draft: true, attachments: [pdf] }), {});
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("Draft saved to drafts (id 53580) with 1 attachment(s)");
    const [raw, mailbox, flags] = vi.mocked(client.addRaw).mock.calls[0];
    expect(mailbox).toBe("drafts");
    expect(flags).toEqual(["draft", "seen"]);
    const email = await parseMessage(raw);
    expect(email.from).toMatchObject({ name: "Me Myself", address: "me@example.com" });
    expect(email.attachments.map((a) => a.filename)).toEqual(["cv.pdf"]);
    expect(client.sendRaw).not.toHaveBeenCalled();
  });

  it("save_draft is refused on himalaya v1", async () => {
    vi.mocked(client.resolveVersion).mockResolvedValue({ major: 1, raw: "himalaya v1.2.0" });
    const result = await handler(server, "compose_email")(composeArgs({ save_draft: true }), {});
    expect(result.isError).toBe(true);
    expect(client.addRaw).not.toHaveBeenCalled();
  });

  it("confirm=true sends a raw message and keeps the sent copy", async () => {
    await handler(server, "compose_email")(composeArgs({ confirm: true, bcc: "hidden@example.com" }), {});
    const [raw, save] = vi.mocked(client.sendRaw).mock.calls[0];
    expect(save).toBe("sent");
    expect(raw).toMatch(/^Bcc: hidden@example\.com/m);
    expect(client.sendTemplate).not.toHaveBeenCalled();
  });

  it("the preview lists attachments instead of v1 MML", async () => {
    const pdf = join(dir, "cv.pdf");
    writeFileSync(pdf, "%PDF-1.4");
    const result = await handler(server, "compose_email")(composeArgs({ attachments: [pdf] }), {});
    expect(result.content[0].text).toContain(`- ${pdf}`);
    expect(result.content[0].text).not.toContain("<#part");
  });

  it("draft_reply decodes v2's reply into a readable template", async () => {
    vi.spyOn(client, "replyRaw").mockResolvedValue(
      "From: me@example.com\r\nTo: you@example.com\r\nIn-Reply-To: <o@x>\r\nReferences: <o@x>\r\nSubject: Re: s\r\n" +
      "Content-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nGrazie=2E\r\n\r\n> Citt=C3=A0\r\n",
    );
    const result = await handler(server, "draft_reply")({ id: "42", body: "Grazie.", reply_all: false, folder: undefined, account: undefined }, {});
    const text = result.content[0].text as string;
    expect(text).toContain("In-Reply-To: <o@x>");
    expect(text).toContain("> Città");
    expect(text).not.toContain("=C3=A0");
    expect(vi.mocked(client.replyRaw).mock.calls[0][2]).toEqual([]);
  });

  it("draft_reply with reply_all passes the original To and Cc minus self and sender", async () => {
    vi.spyOn(client, "readRawMessage").mockResolvedValue(
      "From: boss@x\r\nTo: me@example.com, team@x\r\nCc: TEAM@x, ops@x\r\nSubject: s\r\n\r\nhi\r\n",
    );
    vi.spyOn(client, "replyRaw").mockResolvedValue("From: me@example.com\r\nTo: boss@x\r\nSubject: Re: s\r\n\r\nok\r\n");
    await handler(server, "draft_reply")({ id: "42", body: "ok", reply_all: true, folder: undefined, account: undefined }, {});
    expect(vi.mocked(client.replyRaw).mock.calls[0][2]).toEqual(["team@x", "ops@x"]);
  });

  it("send_email rebuilds the reviewed template, keeping threading headers and attachments", async () => {
    const pdf = join(dir, "cv.pdf");
    writeFileSync(pdf, "%PDF-1.4");
    const template = "From: \"Me Myself\" <me@example.com>\nTo: you@example.com\nSubject: Re: s\nIn-Reply-To: <o@x>\nReferences: <o@x>\n\nGrazie.\n\n> Città\n";
    const result = await handler(server, "send_email")({ template, attachments: [pdf], confirm: true, account: undefined }, {});
    expect(result.isError).toBeFalsy();
    const [raw, save] = vi.mocked(client.sendRaw).mock.calls[0];
    expect(save).toBe("sent");
    const email = await parseMessage(raw);
    expect(email.inReplyTo).toBe("<o@x>");
    expect(email.text).toContain("> Città");
    expect(email.attachments.map((a) => a.filename)).toEqual(["cv.pdf"]);
  });
});

describe("replyAllCc", () => {
  it("prefers Reply-To over From as the reply target", async () => {
    const email = await parseMessage("From: list@x\r\nReply-To: author@x\r\nTo: me@x, list@x\r\n\r\nx\r\n");
    expect(replyAllCc(email, "me@x")).toEqual(["list@x"]);
  });
});
