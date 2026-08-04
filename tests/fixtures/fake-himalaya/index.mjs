#!/usr/bin/env node
/**
 * Fake `himalaya` binary for CI argv smoke-testing (see
 * docs/specs/SPEC-himalaya-v2-cli-compat-2026-08-03.md, Resolved Decision #4).
 *
 * Recognizes the exact argv patterns HimalayaClient is expected to send for
 * both CLI syntax generations, sourced from the live reproduction transcripts
 * in docs/specs/BUG-himalaya-v2-cli-incompatibility-2026-08-03.md -- NOT
 * re-derived by reading src/himalaya/client.ts, so it can't silently share a
 * wrong assumption with the implementation it's checking.
 *
 * FAKE_HIMALAYA_VERSION=1|2 (default 2) selects which generation's syntax is
 * "installed" -- argv from the other generation is rejected the way the real
 * CLI would reject it, so a test can point HimalayaClient at either mode and
 * confirm it sends only that generation's argv.
 *
 * argv matching is plain array comparison / prefix checks -- no shell
 * involved, no string interpolation of argv into anything executed.
 */

const version = process.env.FAKE_HIMALAYA_VERSION === "1" ? 1 : 2;
const argv = process.argv.slice(2);

function hasFlag(name) {
  return argv.includes(name);
}
function startsWith(...prefix) {
  return prefix.every((p, i) => argv[i] === p);
}

const CANNED_ENVELOPES = JSON.stringify({
  envelopes: [
    { id: "1", subject: "fixture envelope", from: [{ name: null, email: "fixture@example.com" }] },
  ],
});
const CANNED_MAILBOXES = JSON.stringify({ mailboxes: [{ id: "Inbox", name: "Inbox", total: null, unread: null }] });
const CANNED_ACCOUNTS = JSON.stringify({ accounts: [{ name: "fixture", default: true, backends: ["imap", "smtp"] }] });

/** Returns { stdout, stderr, code } -- never writes/exits itself. */
function dispatch() {
  if (argv.length === 1 && argv[0] === "--version") {
    return version === 2
      ? { stdout: "himalaya v2.0.0 +gmail +jmap +msgraph +smtp +rustls-ring +imap +m2dir", stderr: "", code: 0 }
      : { stdout: "himalaya 1.1.0", stderr: "", code: 0 };
  }

  if (version === 2) {
    // The v2 CLI hard-rejects the old --output flag -- the exact bug this
    // fix is about, so the fixture must reject it too.
    if (hasFlag("--output")) {
      return { stdout: "", stderr: "error: unexpected argument '--output' found", code: 2 };
    }
    // v2 dropped `folder` in favor of `mailbox`.
    if (argv[0] === "folder") {
      return { stdout: "", stderr: "error: unrecognized subcommand 'folder'", code: 2 };
    }
    // v2's shared mailbox API has no create/delete -- only `imap create/delete`.
    if (startsWith("mailbox", "create") || startsWith("mailbox", "delete")) {
      return { stdout: "", stderr: `error: unrecognized subcommand '${argv[1]}'`, code: 2 };
    }

    if (startsWith("envelope", "list") && hasFlag("--json")) return { stdout: CANNED_ENVELOPES, stderr: "", code: 0 };
    if (startsWith("mailbox", "list") && hasFlag("--json")) return { stdout: CANNED_MAILBOXES, stderr: "", code: 0 };
    if (startsWith("account", "list") && hasFlag("--json")) return { stdout: CANNED_ACCOUNTS, stderr: "", code: 0 };
    if (startsWith("message", "read")) return { stdout: JSON.stringify({ body: "fixture message body" }), stderr: "", code: 0 };
    // Verified live: `himalaya imap create/delete <name> --json` returns
    // {"message": "..."} JSON, not the plain text seen without --json.
    if (startsWith("imap", "create")) return { stdout: JSON.stringify({ message: "Mailbox successfully created" }), stderr: "", code: 0 };
    if (startsWith("imap", "delete")) return { stdout: JSON.stringify({ message: "Mailbox successfully deleted" }), stderr: "", code: 0 };

    return { stdout: "", stderr: `error: unrecognized argv for v2 fixture: ${JSON.stringify(argv)}`, code: 2 };
  }

  // version === 1
  if (argv[0] === "mailbox") {
    return { stdout: "", stderr: "error: unrecognized subcommand 'mailbox'", code: 2 };
  }
  if (hasFlag("--json")) {
    return { stdout: "", stderr: "error: unexpected argument '--json' found", code: 2 };
  }

  if (startsWith("envelope", "list") && hasFlag("--output") && hasFlag("json")) return { stdout: CANNED_ENVELOPES, stderr: "", code: 0 };
  if (startsWith("folder", "list") && hasFlag("--output") && hasFlag("json")) return { stdout: CANNED_MAILBOXES, stderr: "", code: 0 };
  if (startsWith("folder", "create") && hasFlag("--output") && hasFlag("json")) return { stdout: "Folder successfully created", stderr: "", code: 0 };
  if (startsWith("folder", "delete") && hasFlag("--output") && hasFlag("json")) return { stdout: "Folder successfully deleted", stderr: "", code: 0 };
  if (startsWith("account", "list") && hasFlag("--output") && hasFlag("json")) return { stdout: CANNED_ACCOUNTS, stderr: "", code: 0 };
  if (startsWith("message", "read")) return { stdout: JSON.stringify({ body: "fixture message body" }), stderr: "", code: 0 };

  return { stdout: "", stderr: `error: unrecognized argv for v1 fixture: ${JSON.stringify(argv)}`, code: 2 };
}

const { stdout, stderr, code } = dispatch();
if (stdout) process.stdout.write(stdout.endsWith("\n") ? stdout : stdout + "\n");
if (stderr) process.stderr.write(stderr.endsWith("\n") ? stderr : stderr + "\n");
process.exitCode = code;
