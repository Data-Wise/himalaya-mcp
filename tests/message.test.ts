import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildMessage, parseMessage, renderForReview, templateToMessage, addresses } from "../src/himalaya/message.js";

describe("message (himalaya v2 composer)", () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it("round-trips headers, a non-ASCII body and threading headers", async () => {
    const raw = await buildMessage({
      from: '"Gianluca Mazza" <g@example.com>',
      to: "a@example.com",
      cc: "c@example.com",
      subject: "Città – proposta",
      text: "Grazie, è tutto chiaro.",
      inReplyTo: "<orig@example.com>",
      references: "<orig@example.com>",
    });
    const email = await parseMessage(raw);
    expect(email.from?.address).toBe("g@example.com");
    expect(email.from?.name).toBe("Gianluca Mazza");
    expect(email.subject).toBe("Città – proposta");
    expect(email.text?.trim()).toBe("Grazie, è tutto chiaro.");
    expect(email.inReplyTo).toBe("<orig@example.com>");
    expect(addresses(email.cc)).toEqual(["c@example.com"]);
  });

  it("keeps Bcc in the built message (himalaya derives the envelope from it)", async () => {
    const raw = await buildMessage({ from: "g@example.com", to: "a@example.com", bcc: "hidden@example.com", subject: "s", text: "t" });
    expect(raw).toMatch(/^Bcc: hidden@example\.com/m);
  });

  it("embeds attachments that decode back byte for byte", async () => {
    dir = mkdtempSync(join(tmpdir(), "message-test-"));
    const pdf = join(dir, "cv.pdf");
    const bytes = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x00, 0xff, 0x10, 0x80]);
    writeFileSync(pdf, bytes);
    const raw = await buildMessage({ from: "g@example.com", to: "a@example.com", subject: "CV", text: "In allegato", attachments: [pdf] });
    const email = await parseMessage(raw);
    expect(email.attachments).toHaveLength(1);
    expect(email.attachments[0].filename).toBe("cv.pdf");
    expect(email.attachments[0].mimeType).toBe("application/pdf");
    expect(Buffer.from(email.attachments[0].content as ArrayBuffer).equals(bytes)).toBe(true);
  });

  it("renders a quoted-printable reply as readable text that templateToMessage reads back", async () => {
    const qp = [
      'From: "Me" <me@example.com>',
      "To: <you@example.com>",
      "In-Reply-To: <orig@example.com>",
      "References: <orig@example.com>",
      "Subject: Re: Update",
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="utf-8"',
      "Content-Transfer-Encoding: quoted-printable",
      "",
      "Grazie.",
      "",
      "> =E2=9A=A0 Last synced=20",
      "",
    ].join("\r\n");
    const review = renderForReview(await parseMessage(qp));
    expect(review).toContain("> ⚠ Last synced");
    expect(review).not.toContain("=E2=9A");
    expect(review).toMatch(/^In-Reply-To: <orig@example\.com>$/m);

    const message = await templateToMessage(review, { from: "fallback@example.com" });
    expect(message.from).toBe('"Me" <me@example.com>');
    expect(message.to).toBe("you@example.com");
    expect(message.inReplyTo).toBe("<orig@example.com>");
    expect(message.text).toContain("> ⚠ Last synced");
  });

  it("templateToMessage refuses a template without recipients", async () => {
    await expect(templateToMessage("Subject: x\n\nbody", { from: "g@example.com" })).rejects.toThrow(/no To/);
  });
});
