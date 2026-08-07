import { describe, it, expect, vi, beforeEach } from "vitest";
import { promisify } from "node:util";
import { HimalayaClient } from "../src/himalaya/client.js";
import { HimalayaError } from "../src/himalaya/errors.js";

// Mock node:child_process - we use execFile (safe, no shell injection).
// Must preserve util.promisify.custom so promisify(execFile) returns {stdout, stderr}.
vi.mock("node:child_process", async () => {
  const { promisify: realPromisify } = await import("node:util");
  const fn: any = vi.fn();
  const promisified = vi.fn();
  fn[realPromisify.custom] = promisified;
  return { execFile: fn, spawn: vi.fn() };
});

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  rmSync: vi.fn(),
  mkdtempSync: vi.fn(),
}));

vi.mock("node:os", () => ({
  tmpdir: vi.fn().mockReturnValue("/tmp"),
}));

import { execFile, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import * as os from "node:os";

const mockSpawn = vi.mocked(spawn);

/** A minimal fake ChildProcess for sendTemplate()'s spawn() path. */
function fakeChildProcess(exitCode: number, stdout = "", stderr = "") {
  const child: any = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = { write: vi.fn(), end: vi.fn() };
  child.kill = vi.fn();
  // Defer to next tick so listeners registered after spawn() returns still fire.
  queueMicrotask(() => {
    if (stdout) child.stdout.emit("data", Buffer.from(stdout));
    if (stderr) child.stderr.emit("data", Buffer.from(stderr));
    child.emit("close", exitCode);
  });
  return child;
}

const mockExecFile = vi.mocked(execFile);
// Access the promisified version that client.ts actually calls
const mockExecFileAsync = (execFile as any)[promisify.custom] as ReturnType<typeof vi.fn>;

const V2_VERSION_STDOUT = "himalaya v2.0.0 +gmail +jmap +msgraph +smtp +rustls-ring +imap +m2dir";
const V1_VERSION_STDOUT = "himalaya 1.1.0";
const DEFAULT_ACCOUNTS_STDOUT = JSON.stringify({
  accounts: [{ name: "default", default: true, backends: ["imap", "smtp"] }],
});

interface MockConfig {
  /** Raw `himalaya --version` stdout. Defaults to the real v2.0.0 string. */
  version?: string;
  /** Raw `himalaya account list --json` stdout (accounts.ts's own call, used by the
   *  fail-closed backend check in createFolder/deleteFolder). */
  accounts?: string;
  stdout?: string;
  stderr?: string;
  error?: Error;
}

/**
 * HimalayaClient's execOnce() now shells out to `--version` before every real
 * command (resolveVersion()), and createFolder/deleteFolder on v2 shell out
 * to `account list --json` (via accounts.ts, independently of client.ts) for
 * the fail-closed backend check. A single mockResolvedValue can't answer all
 * three distinct call shapes, so dispatch on argv instead.
 */
function configureMock(cfg: MockConfig) {
  const versionStdout = cfg.version ?? V2_VERSION_STDOUT;
  const accountsStdout = cfg.accounts ?? DEFAULT_ACCOUNTS_STDOUT;
  mockExecFileAsync.mockImplementation(async (_binary: string, args: string[]) => {
    if (args.length === 1 && args[0] === "--version") {
      return { stdout: versionStdout, stderr: "" };
    }
    if (args[0] === "account" && args[1] === "list" && args.includes("--json")) {
      return { stdout: accountsStdout, stderr: "" };
    }
    if (cfg.error) throw cfg.error;
    return { stdout: cfg.stdout ?? "[]", stderr: cfg.stderr ?? "" };
  });
}

function setupMock(stdout: string, stderr = "") {
  configureMock({ stdout, stderr });
}

function setupErrorMock(error: Error) {
  configureMock({ error });
}

describe("HimalayaClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("uses default options", () => {
      const client = new HimalayaClient();
      expect(client).toBeDefined();
    });

    it("accepts custom options", () => {
      const client = new HimalayaClient({
        binary: "/usr/local/bin/himalaya",
        account: "work",
        folder: "Sent Items",
        timeout: 60_000,
      });
      expect(client).toBeDefined();
    });
  });

  describe("exec", () => {
    it("passes --json flag on himalaya v2", async () => {
      configureMock({ version: V2_VERSION_STDOUT, stdout: "[]" });
      const client = new HimalayaClient();
      await client.exec(["envelope", "list"]);

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "himalaya",
        expect.arrayContaining(["--json"]),
        expect.any(Object),
      );
      // and never the removed v1 flag
      const commandCall = mockExecFileAsync.mock.calls.find((c: any[]) => c[1][0] === "envelope");
      expect(commandCall![1]).not.toContain("--output");
    });

    it("passes --output json flag on himalaya v1.x", async () => {
      configureMock({ version: V1_VERSION_STDOUT, stdout: "[]" });
      const client = new HimalayaClient();
      await client.exec(["envelope", "list"]);

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "himalaya",
        expect.arrayContaining(["--output", "json"]),
        expect.any(Object),
      );
      const commandCall = mockExecFileAsync.mock.calls.find((c: any[]) => c[1][0] === "envelope");
      expect(commandCall![1]).not.toContain("--json");
    });

    it("shells out to --version at most once per client instance across multiple exec() calls", async () => {
      configureMock({ stdout: "[]" });
      const client = new HimalayaClient();
      await client.exec(["envelope", "list"]);
      await client.exec(["account", "list"]);
      await client.exec(["envelope", "list"]);

      const versionCalls = mockExecFileAsync.mock.calls.filter((c: any[]) => c[1].length === 1 && c[1][0] === "--version");
      expect(versionCalls).toHaveLength(1);
    });

    it("throws himalaya_version_undetected (not retried) when --version is unparseable", async () => {
      configureMock({ version: "himalaya (git rev unknown)" });
      const client = new HimalayaClient({ retryBackoffMs: 0 });

      try {
        await client.exec(["envelope", "list"]);
        throw new Error("expected to throw");
      } catch (e) {
        expect(e).toBeInstanceOf(HimalayaError);
        expect((e as HimalayaError).envelope.code).toBe("himalaya_version_undetected");
      }
      // Only the single --version probe call, never a retried second probe
      // and never the real command (which never got to run).
      expect(mockExecFileAsync).toHaveBeenCalledTimes(1);
    });

    it("passes --account flag when set", async () => {
      setupMock("[]");
      const client = new HimalayaClient({ account: "work" });
      await client.exec(["envelope", "list"]);

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "himalaya",
        expect.arrayContaining(["--account", "work"]),
        expect.any(Object),
      );
    });

    it("returns stdout", async () => {
      setupMock('[{"id":"1"}]');
      const client = new HimalayaClient();
      const result = await client.exec(["envelope", "list"]);
      expect(result).toBe('[{"id":"1"}]');
    });
  });

  describe("error envelope", () => {
    async function captureError(client: HimalayaClient): Promise<HimalayaError> {
      try {
        await client.exec(["envelope", "list"]);
        throw new Error("expected to throw");
      } catch (err) {
        if (!(err instanceof HimalayaError)) {
          throw new Error(`expected HimalayaError, got ${err}`);
        }
        return err;
      }
    }

    it("wraps ENOENT as himalaya_not_installed envelope", async () => {
      const err = Object.assign(new Error("spawn himalaya ENOENT"), { code: "ENOENT" });
      setupErrorMock(err);
      const himalayaErr = await captureError(new HimalayaClient({ account: "work" }));
      expect(himalayaErr.envelope.code).toBe("himalaya_not_installed");
      expect(himalayaErr.envelope.account).toBe("work");
      expect(himalayaErr.envelope.hint).toMatch(/brew install/);
      expect(himalayaErr.envelope.recoverable).toBe(true);
    });

    it("wraps killed process as imap_timeout envelope", async () => {
      const err = Object.assign(new Error("killed"), { killed: true });
      setupErrorMock(err);
      const himalayaErr = await captureError(new HimalayaClient());
      expect(himalayaErr.envelope.code).toBe("imap_timeout");
      expect(himalayaErr.envelope.message).toMatch(/timed out/);
      expect(himalayaErr.envelope.recoverable).toBe(true);
    });

    it("classifies auth errors as imap_auth_failed envelope", async () => {
      const err = new Error("authentication failed: bad credentials");
      setupErrorMock(err);
      const himalayaErr = await captureError(new HimalayaClient());
      expect(himalayaErr.envelope.code).toBe("imap_auth_failed");
      expect(himalayaErr.envelope.hint).toMatch(/configure/i);
    });

    it("classifies stderr text from execFile error", async () => {
      const err = Object.assign(new Error("exited 1"), {
        stderr: "AUTHENTICATIONFAILED for user@example.com",
      });
      setupErrorMock(err);
      const himalayaErr = await captureError(new HimalayaClient({ account: "unm" }));
      expect(himalayaErr.envelope.code).toBe("imap_auth_failed");
      expect(himalayaErr.envelope.account).toBe("unm");
      expect(himalayaErr.envelope.recoverable).toBe(true);
    });

    it("falls back to 'unknown' on unmatched stderr", async () => {
      const err = Object.assign(new Error("exited 1"), { stderr: "something totally weird" });
      setupErrorMock(err);
      const himalayaErr = await captureError(new HimalayaClient({ account: "unm" }));
      expect(himalayaErr.envelope.code).toBe("unknown");
      expect(himalayaErr.envelope.rawStderr).toContain("totally weird");
    });

    it("carries account name in envelope (default omitted when none set)", async () => {
      const err = Object.assign(new Error("fail"), { stderr: "ECONNRESET" });
      setupErrorMock(err);
      // Transient errors now retry; disable backoff to keep test fast.
      const himalayaErr = await captureError(new HimalayaClient({ retryBackoffMs: 0 }));
      expect(himalayaErr.envelope.code).toBe("transient");
      expect(himalayaErr.envelope.account).toBeUndefined();
    });
  });

  describe("convenience methods", () => {
    it("listEnvelopes builds correct args on v1.x (--folder)", async () => {
      configureMock({ version: V1_VERSION_STDOUT, stdout: "[]" });
      const client = new HimalayaClient();
      await client.listEnvelopes("Sent Items", 10, 2);

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "himalaya",
        expect.arrayContaining(["envelope", "list", "--folder", "Sent Items", "--page-size", "10", "--page", "2"]),
        expect.any(Object),
      );
    });

    it("listEnvelopes builds correct args on v2 (--mailbox)", async () => {
      configureMock({ version: V2_VERSION_STDOUT, stdout: "[]" });
      const client = new HimalayaClient();
      await client.listEnvelopes("Sent Items", 10, 2);

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "himalaya",
        expect.arrayContaining(["envelope", "list", "--mailbox", "Sent Items", "--page-size", "10", "--page", "2"]),
        expect.any(Object),
      );
      const call = mockExecFileAsync.mock.calls.find((c) => (c[1] as string[])[0] === "envelope");
      expect(call![1]).not.toContain("--folder");
    });

    it("searchEnvelopes on v2 uses the dedicated envelope search subcommand", async () => {
      configureMock({ version: V2_VERSION_STDOUT, stdout: "[]" });
      const client = new HimalayaClient();
      await client.searchEnvelopes("subject invoice", "INBOX");

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "himalaya",
        expect.arrayContaining(["envelope", "search", "subject", "invoice"]),
        expect.any(Object),
      );
      const call = mockExecFileAsync.mock.calls.find((c) => (c[1] as string[])[0] === "envelope");
      expect((call![1] as string[])[1]).toBe("search");
      expect(call![1]).not.toContain("list");
    });

    it("searchEnvelopes on v1.x keeps passing the DSL to envelope list", async () => {
      configureMock({ version: V1_VERSION_STDOUT, stdout: "[]" });
      const client = new HimalayaClient();
      await client.searchEnvelopes("subject invoice", "INBOX");

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "himalaya",
        expect.arrayContaining(["envelope", "list", "subject", "invoice"]),
        expect.any(Object),
      );
    });

    it("searchEnvelopes on v2 orders flags before the greedy query positional", async () => {
      configureMock({ version: V2_VERSION_STDOUT, stdout: "[]" });
      const client = new HimalayaClient();
      await client.searchEnvelopes("flag Flagged", "INBOX");

      const call = mockExecFileAsync.mock.calls.find((c) => (c[1] as string[])[0] === "envelope");
      const argv = call![1] as string[];
      // The query DSL is a greedy positional on v2, so every flag must precede
      // the query tokens or clap swallows them.
      expect(argv.indexOf("flag")).toBeGreaterThan(argv.indexOf("--json"));
    });

    it("readMessage passes id", async () => {
      setupMock('""');
      const client = new HimalayaClient();
      await client.readMessage("12345");

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "himalaya",
        expect.arrayContaining(["message", "read", "12345"]),
        expect.any(Object),
      );
    });

    it("readMessageHtml uses message export instead of removed --html flag", async () => {
      setupMock("");
      vi.mocked(fs.mkdtempSync).mockReturnValue("/tmp/himalaya-mcp-html-test");
      vi.mocked(fs.readFileSync).mockReturnValue("<p>Test HTML content</p>");
      vi.mocked(fs.rmSync).mockImplementation(() => {});
      vi.mocked(os.tmpdir).mockReturnValue("/tmp");

      const client = new HimalayaClient();
      const result = await client.readMessageHtml("12345");

      expect(result).toBe("<p>Test HTML content</p>");
      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "himalaya",
        expect.arrayContaining(["message", "export", "--destination", "/tmp/himalaya-mcp-html-test", "12345"]),
        expect.any(Object),
      );
      // Ensure the old --html flag is NOT used
      const args = mockExecFileAsync.mock.calls[0][1] as string[];
      expect(args).not.toContain("--html");
    });

    it("listFolders calls mailbox list on himalaya v2", async () => {
      configureMock({ version: V2_VERSION_STDOUT, stdout: "[]" });
      const client = new HimalayaClient();
      await client.listFolders();

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "himalaya",
        expect.arrayContaining(["mailbox", "list"]),
        expect.any(Object),
      );
    });

    it("listFolders calls folder list on himalaya v1.x", async () => {
      configureMock({ version: V1_VERSION_STDOUT, stdout: "[]" });
      const client = new HimalayaClient();
      await client.listFolders();

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "himalaya",
        expect.arrayContaining(["folder", "list"]),
        expect.any(Object),
      );
    });
  });

  describe("sendTemplate dual-syntax (spawn path, not exec())", () => {
    it("passes --json flag on himalaya v2", async () => {
      configureMock({ version: V2_VERSION_STDOUT });
      mockSpawn.mockImplementation(() => fakeChildProcess(0, "ok"));
      const client = new HimalayaClient();

      await client.sendTemplate("From: a@b.com\n\nhi");

      expect(mockSpawn).toHaveBeenCalledWith(
        "himalaya",
        expect.arrayContaining(["template", "send", "--json"]),
        expect.any(Object),
      );
      const spawnArgs = mockSpawn.mock.calls[0][1] as string[];
      expect(spawnArgs).not.toContain("--output");
    });

    it("passes --output json flag on himalaya v1.x", async () => {
      configureMock({ version: V1_VERSION_STDOUT });
      mockSpawn.mockImplementation(() => fakeChildProcess(0, "ok"));
      const client = new HimalayaClient();

      await client.sendTemplate("From: a@b.com\n\nhi");

      expect(mockSpawn).toHaveBeenCalledWith(
        "himalaya",
        expect.arrayContaining(["template", "send", "--output", "json"]),
        expect.any(Object),
      );
    });
  });

  describe("createFolder / deleteFolder dual-path (v2: imap create/delete)", () => {
    it("v1.x: createFolder calls folder create", async () => {
      configureMock({ version: V1_VERSION_STDOUT, stdout: "ok" });
      const client = new HimalayaClient();
      await client.createFolder("Archive");

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "himalaya",
        expect.arrayContaining(["folder", "create", "Archive"]),
        expect.any(Object),
      );
    });

    it("v1.x: deleteFolder calls folder delete --yes", async () => {
      configureMock({ version: V1_VERSION_STDOUT, stdout: "ok" });
      const client = new HimalayaClient();
      await client.deleteFolder("Archive");

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "himalaya",
        expect.arrayContaining(["folder", "delete", "--yes", "Archive"]),
        expect.any(Object),
      );
    });

    it("v2 + confirmed IMAP account: createFolder calls imap create", async () => {
      configureMock({
        version: V2_VERSION_STDOUT,
        accounts: JSON.stringify({ accounts: [{ name: "default", default: true, backends: ["imap"] }] }),
        stdout: "Mailbox successfully created",
      });
      const client = new HimalayaClient();
      await client.createFolder("Archive");

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "himalaya",
        expect.arrayContaining(["imap", "create", "Archive"]),
        expect.any(Object),
      );
    });

    it("v2 + confirmed IMAP account: deleteFolder calls imap delete", async () => {
      configureMock({
        version: V2_VERSION_STDOUT,
        accounts: JSON.stringify({ accounts: [{ name: "default", default: true, backends: ["imap"] }] }),
        stdout: "Mailbox successfully deleted",
      });
      const client = new HimalayaClient();
      await client.deleteFolder("Archive");

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "himalaya",
        expect.arrayContaining(["imap", "delete", "Archive"]),
        expect.any(Object),
      );
    });

    it("v2 + non-IMAP backend: fails closed with unsupported_backend, never calls imap create", async () => {
      configureMock({
        version: V2_VERSION_STDOUT,
        accounts: JSON.stringify({ accounts: [{ name: "default", default: true, backends: ["jmap", "smtp"] }] }),
      });
      const client = new HimalayaClient();

      try {
        await client.createFolder("Archive");
        throw new Error("expected to throw");
      } catch (e) {
        expect(e).toBeInstanceOf(HimalayaError);
        expect((e as HimalayaError).envelope.code).toBe("unsupported_backend");
      }
      const imapCall = mockExecFileAsync.mock.calls.find((c: any[]) => c[1][0] === "imap");
      expect(imapCall).toBeUndefined();
    });

    it("v2 + missing backends field: fails closed with unsupported_backend, never calls imap create", async () => {
      configureMock({
        version: V2_VERSION_STDOUT,
        accounts: JSON.stringify({ accounts: [{ name: "default", default: true }] }),
      });
      const client = new HimalayaClient();

      try {
        await client.createFolder("Archive");
        throw new Error("expected to throw");
      } catch (e) {
        expect(e).toBeInstanceOf(HimalayaError);
        expect((e as HimalayaError).envelope.code).toBe("unsupported_backend");
      }
      const imapCall = mockExecFileAsync.mock.calls.find((c: any[]) => c[1][0] === "imap");
      expect(imapCall).toBeUndefined();
    });

    it("v2 + empty (malformed) backends array: fails closed with unsupported_backend, never calls imap create", async () => {
      configureMock({
        version: V2_VERSION_STDOUT,
        accounts: JSON.stringify({ accounts: [{ name: "default", default: true, backends: [] }] }),
      });
      const client = new HimalayaClient();

      try {
        await client.createFolder("Archive");
        throw new Error("expected to throw");
      } catch (e) {
        expect(e).toBeInstanceOf(HimalayaError);
        expect((e as HimalayaError).envelope.code).toBe("unsupported_backend");
      }
      const imapCall = mockExecFileAsync.mock.calls.find((c: any[]) => c[1][0] === "imap");
      expect(imapCall).toBeUndefined();
    });

    it.each(["Archive/Nested", "#shared/mailbox", ".hidden"])(
      "v2 + confirmed IMAP account: rejects namespace-unsafe name %s before any subprocess call beyond version detection",
      async (unsafeName) => {
        configureMock({
          version: V2_VERSION_STDOUT,
          accounts: JSON.stringify({ accounts: [{ name: "default", default: true, backends: ["imap"] }] }),
        });
        const client = new HimalayaClient();

        await expect(client.createFolder(unsafeName)).rejects.toThrow(/namespace-hierarchy character/);

        // Only the --version probe ran; neither account list nor imap create
        // was reached, since the namespace check runs before both.
        const nonVersionCalls = mockExecFileAsync.mock.calls.filter(
          (c: any[]) => !(c[1].length === 1 && c[1][0] === "--version"),
        );
        expect(nonVersionCalls).toHaveLength(0);
      },
    );
  });

  describe("flag-injection guard", () => {
    it("rejects an id that starts with a dash", async () => {
      const client = new HimalayaClient();
      await expect(client.readMessage("--help")).rejects.toThrow(/looks like a flag/);
    });

    it("rejects a target folder that starts with a dash", async () => {
      const client = new HimalayaClient();
      await expect(client.moveMessage("1", "--config=/tmp/evil")).rejects.toThrow(/looks like a flag/);
    });

    it("rejects a folder override that starts with a dash", async () => {
      const client = new HimalayaClient();
      await expect(client.listEnvelopes("--help")).rejects.toThrow(/looks like a flag/);
    });

    it("rejects a flag argument that starts with a dash", async () => {
      const client = new HimalayaClient();
      await expect(client.flagMessage("1", ["--help"], "add")).rejects.toThrow(/looks like a flag/);
    });

    it("rejects an account override that starts with a dash", async () => {
      setupMock("[]");
      const client = new HimalayaClient();
      await expect(
        client.exec(["envelope", "list"], { account: "--config=/tmp/evil" }),
      ).rejects.toThrow(/looks like a flag/);
    });

    it("rejects a new folder name that starts with a dash", async () => {
      const client = new HimalayaClient();
      await expect(client.createFolder("--help")).rejects.toThrow(/looks like a flag/);
    });

    it("rejects a send template that starts with a dash", async () => {
      const client = new HimalayaClient();
      await expect(client.sendTemplate("--help")).rejects.toThrow(/looks like a flag/);
    });

    it("does not reach execFile when a flag is rejected", async () => {
      const client = new HimalayaClient();
      await expect(client.readMessage("--help")).rejects.toThrow();
      expect(mockExecFileAsync).not.toHaveBeenCalled();
    });
  });

  describe("searchEnvelopes tokenizer", () => {
    it("keeps a quoted multi-word value as one argv entry", async () => {
      setupMock("[]");
      const client = new HimalayaClient();
      await client.searchEnvelopes('subject "meeting notes"', "INBOX");

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "himalaya",
        expect.arrayContaining(["envelope", "search", "subject", "meeting notes"]),
        expect.any(Object),
      );
    });

    it("handles single quotes", async () => {
      setupMock("[]");
      const client = new HimalayaClient();
      await client.searchEnvelopes("from 'foo bar@example.com'", "INBOX");

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "himalaya",
        expect.arrayContaining(["envelope", "search", "from", "foo bar@example.com"]),
        expect.any(Object),
      );
    });

    it("collapses runs of whitespace", async () => {
      setupMock("[]");
      const client = new HimalayaClient();
      await client.searchEnvelopes("subject    invoice", "INBOX");

      const call = mockExecFileAsync.mock.calls.find(
        (c) => (c[1] as string[])[0] === "envelope",
      );
      const argv = call?.[1] as string[];
      expect(argv.filter((a) => a === "")).toHaveLength(0);
      expect(argv).toContain("subject");
      expect(argv).toContain("invoice");
    });

    it("rejects a query token that starts with a dash", async () => {
      const client = new HimalayaClient();
      await expect(
        client.searchEnvelopes("subject foo --folder Trash", "INBOX"),
      ).rejects.toThrow(/looks like a flag/);
    });
  });
});

describe("stderr surfaced on empty stdout", () => {
  const VERSION_STDOUT = { stdout: V2_VERSION_STDOUT, stderr: "" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws HimalayaError with stderr content when stdout is empty", async () => {
    mockExecFileAsync
      .mockResolvedValueOnce(VERSION_STDOUT)
      .mockResolvedValue({
        stdout: "",
        stderr: "Error: cannot parse search emails query `toilet`",
      });
    const client = new HimalayaClient({ retryBackoffMs: 0 });

    await expect(client.exec(["envelope", "list"])).rejects.toThrow(HimalayaError);
  });

  it("ignores stderr when stdout has valid content", async () => {
    mockExecFileAsync
      .mockResolvedValueOnce(VERSION_STDOUT)
      .mockResolvedValue({
        stdout: '[{"id":"1","subject":"test"}]',
        stderr: "WARN imap_codec::response: Rectified missing text",
      });
    const client = new HimalayaClient();

    const result = await client.exec(["envelope", "list"]);
    expect(result).toContain('"id":"1"');
  });

  it("returns empty stdout when both stdout and stderr are empty", async () => {
    mockExecFileAsync
      .mockResolvedValueOnce(VERSION_STDOUT)
      .mockResolvedValue({ stdout: "[]", stderr: "WARN some harmless warning" });
    const client = new HimalayaClient();

    await expect(client.exec(["envelope", "list"])).resolves.toBe("[]");
  });
});
