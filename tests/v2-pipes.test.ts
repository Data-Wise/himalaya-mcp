import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, chmodSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HimalayaClient } from "../src/himalaya/client.js";

/**
 * The v2 write paths run real subprocesses against a fake himalaya v2 that
 * records argv and stdin: what matters (argument order, stdin, no retry, a
 * message larger than one argv element may be) lives at that boundary.
 */
describe("himalaya v2 write paths (subprocess)", () => {
  let dir: string;
  let bin: string;

  const fake = (body: string) => {
    writeFileSync(bin, `#!/bin/sh
if [ "$1" = "--version" ]; then echo "himalaya v2.1.0 +imap +smtp"; exit 0; fi
printf '%s\\n' "$@" > "${dir}/argv"
echo x >> "${dir}/calls"
${body}
`);
    chmodSync(bin, 0o755);
  };
  const argv = () => readFileSync(join(dir, "argv"), "utf8").trim().split("\n");

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "v2-pipes-"));
    bin = join(dir, "himalaya");
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("addRaw streams the message on stdin with flags on the APPEND, and returns the id", async () => {
    fake(`cat > "${dir}/stdin"; echo '{"id":"53580","sent":false}'`);
    const client = new HimalayaClient({ binary: bin, account: "work" });
    const raw = "From: a@b.c\r\nTo: d@e.f\r\nSubject: s\r\n\r\n" + "A".repeat(300 * 1024);
    await expect(client.addRaw(raw, "drafts", ["draft", "seen"])).resolves.toBe("53580");
    expect(argv()).toEqual(["message", "add", "--mailbox", "drafts", "--json", "--flag", "draft", "--flag", "seen", "--account", "work"]);
    expect(readFileSync(join(dir, "stdin"), "utf8")).toBe(raw);
  });

  it("sendRaw asks v2 to keep the sent copy", async () => {
    fake(`cat > "${dir}/stdin"; echo '{"sent":true}'`);
    const client = new HimalayaClient({ binary: bin, account: "work" });
    await client.sendRaw("From: a@b.c\r\nTo: d@e.f\r\n\r\nx\r\n", "sent");
    expect(argv()).toEqual(["message", "send", "--json", "--save", "sent", "--account", "work"]);
  });

  it("does not retry a failed send: the server may already have acted", async () => {
    fake(`cat > /dev/null; echo "ECONNRESET" >&2; exit 1`);
    const client = new HimalayaClient({ binary: bin, account: "work", retryBackoffMs: 0 });
    await expect(client.sendRaw("From: a@b.c\r\nTo: d@e.f\r\n\r\nx\r\n", "sent")).rejects.toThrow();
    expect(readFileSync(join(dir, "calls"), "utf8").trim().split("\n")).toHaveLength(1);
  });

  it("replyRaw passes body and cc as options and returns the printed message", async () => {
    fake(`printf 'From: me@x\\r\\nTo: you@x\\r\\nSubject: Re: s\\r\\n\\r\\nok\\r\\n'`);
    const client = new HimalayaClient({ binary: bin, account: "work" });
    const raw = await client.replyRaw("42", "ok", ["c1@x", "c2@x"], "Archive");
    expect(raw).toContain("Subject: Re: s");
    expect(argv()).toEqual(
      ["message", "reply", "42", "--body", "ok", "--cc", "c1@x", "--cc", "c2@x", "--mailbox", "Archive", "--account", "work", "--json"],
    );
  });

  it("readRawMessage reads --raw and unwraps {message}", async () => {
    fake(`printf '%s' '{"message":"From: a@b.c\\r\\n\\r\\nhello\\r\\n"}'`);
    const client = new HimalayaClient({ binary: bin, account: "work" });
    await expect(client.readRawMessage("7")).resolves.toBe("From: a@b.c\r\n\r\nhello\r\n");
    expect(argv().slice(0, 4)).toEqual(["message", "read", "7", "--raw"]);
  });

  it("readMessage on v2 returns the decoded text part, JSON-encoded like v1", async () => {
    fake(`printf '%s' '{"message":"From: a@b.c\\r\\nContent-Type: text/plain; charset=utf-8\\r\\nContent-Transfer-Encoding: quoted-printable\\r\\n\\r\\nCitt=C3=A0\\r\\n"}'`);
    const client = new HimalayaClient({ binary: bin, account: "work" });
    expect(JSON.parse(await client.readMessage("7")).trim()).toBe("Città");
  });

  it("downloadAttachments uses v2's positional id and --dir", async () => {
    fake(`echo '{}'`);
    const client = new HimalayaClient({ binary: bin, account: "work" });
    await client.downloadAttachments("9", "/tmp/out", "Archive");
    expect(argv()).toEqual(["attachment", "download", "9", "--dir", "/tmp/out", "--mailbox", "Archive", "--account", "work", "--json"]);
    expect(existsSync(join(dir, "calls"))).toBe(true);
  });

  it("searchEnvelopes hands v2 the query verbatim, quotes included", async () => {
    fake(`echo '{"envelopes":[]}'`);
    const client = new HimalayaClient({ binary: bin, account: "work" });
    await client.searchEnvelopes('subject "quarterly report" and not flag seen', "Archive");
    expect(argv()).toEqual([
      "envelope", "search", "--mailbox", "Archive", "--account", "work", "--json",
      'subject "quarterly report" and not flag seen',
    ]);
  });
});

