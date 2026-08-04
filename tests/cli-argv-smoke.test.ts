import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { HimalayaClient } from "../src/himalaya/client";

/**
 * Genuine subprocess spawn against the fake `himalaya` binary fixture
 * (tests/fixtures/fake-himalaya/) -- no mocking of node:child_process here.
 * This validates the *actual argv* HimalayaClient sends is something a real
 * CLI would accept, which the mocked tests in client.test.ts structurally
 * cannot catch (they intercept before argv ever matters).
 *
 * The fixture's expected argv was authored from the live reproduction
 * transcripts in docs/specs/BUG-himalaya-v2-cli-incompatibility-2026-08-03.md,
 * not from reading client.ts -- see the fixture's own header comment.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_BINARY = join(__dirname, "fixtures", "fake-himalaya", "index.mjs");

function clientFor(version: "1" | "2") {
  process.env.FAKE_HIMALAYA_VERSION = version;
  // Also set HIMALAYA_BINARY so accounts.ts's independent listAccounts()
  // call (used by createFolder/deleteFolder's fail-closed backend check)
  // hits the same fixture, not a real installed himalaya.
  process.env.HIMALAYA_BINARY = FIXTURE_BINARY;
  return new HimalayaClient({ binary: FIXTURE_BINARY, retryBackoffMs: 0 });
}

describe("cli-argv-smoke (real subprocess, no mocking) -- v2 syntax", () => {
  beforeEach(() => { process.env.FAKE_HIMALAYA_VERSION = "2"; process.env.HIMALAYA_BINARY = FIXTURE_BINARY; });
  afterEach(() => { delete process.env.FAKE_HIMALAYA_VERSION; delete process.env.HIMALAYA_BINARY; });

  it("listEnvelopes: real fixture accepts the argv and returns canned JSON", async () => {
    const client = clientFor("2");
    const result = await client.listEnvelopes();
    expect(JSON.parse(result)).toHaveProperty("envelopes");
  });

  it("listFolders: real fixture accepts mailbox list --json", async () => {
    const client = clientFor("2");
    const result = await client.listFolders();
    expect(JSON.parse(result)).toHaveProperty("mailboxes");
  });

  it("createFolder on a confirmed-IMAP account: real fixture accepts imap create", async () => {
    const client = clientFor("2");
    const result = await client.createFolder("smoke-test-box");
    expect(result).toContain("Mailbox successfully created");
  });

  it("deleteFolder on a confirmed-IMAP account: real fixture accepts imap delete", async () => {
    const client = clientFor("2");
    const result = await client.deleteFolder("smoke-test-box");
    expect(result).toContain("Mailbox successfully deleted");
  });

  it("negative path: a namespace-unsafe name is rejected client-side, never reaches the fixture", async () => {
    const client = clientFor("2");
    // If this reached the real fixture with an unrecognized name, the fixture
    // would still accept it (imap create has no name-format opinion) -- so a
    // rejection here can ONLY come from our own client-side namespace check,
    // not from the fixture. The distinct error text confirms which layer fired.
    await expect(client.createFolder("a/b")).rejects.toThrow(/namespace-hierarchy character/);
  });

  it("negative path: a flag-smuggling name is rejected client-side (assertSafeArg), never reaches the fixture", async () => {
    const client = clientFor("2");
    await expect(client.createFolder("--help")).rejects.toThrow(/looks like a flag/);
  });
});

describe("cli-argv-smoke (real subprocess, no mocking) -- v1.x syntax", () => {
  beforeEach(() => { process.env.FAKE_HIMALAYA_VERSION = "1"; process.env.HIMALAYA_BINARY = FIXTURE_BINARY; });
  afterEach(() => { delete process.env.FAKE_HIMALAYA_VERSION; delete process.env.HIMALAYA_BINARY; });

  it("listEnvelopes: real fixture accepts --output json argv", async () => {
    const client = clientFor("1");
    const result = await client.listEnvelopes();
    expect(JSON.parse(result)).toHaveProperty("envelopes");
  });

  it("listFolders: real fixture accepts folder list --output json", async () => {
    const client = clientFor("1");
    const result = await client.listFolders();
    expect(JSON.parse(result)).toHaveProperty("mailboxes");
  });

  it("createFolder: real fixture accepts folder create --output json (no backend check on v1)", async () => {
    const client = clientFor("1");
    const result = await client.createFolder("smoke-test-box");
    expect(result).toContain("Folder successfully created");
  });

  it("deleteFolder: real fixture accepts folder delete --output json", async () => {
    const client = clientFor("1");
    const result = await client.deleteFolder("smoke-test-box");
    expect(result).toContain("Folder successfully deleted");
  });
});
