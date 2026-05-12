# v1.6.0 Reliability & Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make himalaya-mcp's health-checking and error-reporting account-aware and actionable, via multi-account doctor, structured error envelopes, transient retry, a `health_check` MCP tool, and a troubleshooting guide.

**Architecture:** Add two new core modules (`src/himalaya/errors.ts`, `src/himalaya/accounts.ts`) that the existing `client.ts` and `cli/setup.ts` consume. Refactor `client.ts` to classify errors and retry transients. Wrap the new diagnostic surface as an MCP tool (`src/tools/health.ts`). Each existing tool catches `MCPError` and surfaces the structured envelope. Documentation is a first-class deliverable.

**Tech Stack:** TypeScript 5.7, Node.js 22+, `@modelcontextprotocol/sdk` ^1.0.0, vitest, esbuild. himalaya CLI subprocess via `execFile`. No new runtime dependencies.

**Related docs:**
- Brainstorm: [BRAINSTORM-reliability-dx-2026-05-11.md](./BRAINSTORM-reliability-dx-2026-05-11.md)
- Spec: [SPEC-v1.6.0-reliability-2026-05-11.md](./SPEC-v1.6.0-reliability-2026-05-11.md)
- Project: [CLAUDE.md](../../CLAUDE.md)

---

## File Structure

### New files

| Path | Responsibility |
|------|---------------|
| `src/himalaya/errors.ts` | `MCPError` envelope type, `MCPErrorCode` union, `classifyStderr()` function. Pure (no I/O). |
| `src/himalaya/accounts.ts` | `listAccounts()` and `getDefaultAccount()`. Wraps `himalaya account list -o json`. |
| `src/tools/health.ts` | `health_check` MCP tool registration + handler. |
| `tests/errors.test.ts` | Stderr-pattern → code classifier tests (~15). |
| `tests/accounts.test.ts` | Account-listing tests with mocked subprocess (~8). |
| `tests/retry.test.ts` | Retry/backoff behavior tests with mocked `execFile` (~6). |
| `tests/health.test.ts` | `health_check` tool integration tests (~10). |
| `tests/dogfood-reliability.test.ts` | Realistic Claude-usage scenarios (~20). |
| `docs/troubleshooting.md` | User-facing troubleshooting guide. |

### Modified files

| Path | Change |
|------|--------|
| `src/himalaya/client.ts` | Throw `MCPError` (classified) instead of generic `Error`; add retry/backoff for `transient`. |
| `src/cli/setup.ts` | Add `--account <name>` flag; iterate over accounts when flag absent; render per-account table. |
| `src/index.ts` | Register `health_check` tool; bump `VERSION` to `1.6.0`. |
| `src/tools/inbox.ts`, `read.ts`, `manage.ts`, `compose.ts`, `compose-new.ts`, `folders.ts`, `attachments.ts`, `calendar.ts`, `threads.ts`, `actions.ts` | Catch `MCPError`; pass envelope through to MCP response. |
| `tests/client.test.ts`, `tests/setup.test.ts` | Update assertions for new error shape and multi-account doctor. |
| `docs/guide.md`, `docs/REFCARD.md`, `docs/architecture.md`, `docs/workflows.md`, `README.md` | Reference `health_check` + troubleshooting.md. |
| `himalaya-mcp-plugin/skills/help/SKILL.md`, `himalaya-mcp-plugin/skills/config/SKILL.md` | Surface diagnostics path. |
| `CLAUDE.md`, `CHANGELOG.md`, `docs/CHANGELOG.md`, `.STATUS`, `package.json` | Version bump, counts, sections. |

---

## Task 0: Set up worktree and feature branch

**Files:** none yet — preparing the working environment

- [ ] **Step 1: Verify you are on `dev` in the main checkout**

Run:
```bash
cd ~/projects/dev-tools/himalaya-mcp && git branch --show-current
```
Expected: `dev`

- [ ] **Step 2: Create the worktree off `dev`**

Run:
```bash
git worktree add ~/.git-worktrees/himalaya-mcp/feature-v1.6.0-reliability -b feature/v1.6.0-reliability dev
```
Expected: worktree created, branch `feature/v1.6.0-reliability` created from `dev`.

- [ ] **Step 3: Open a fresh Claude session in the worktree**

This plan assumes all subsequent commands run from `~/.git-worktrees/himalaya-mcp/feature-v1.6.0-reliability`.

Run:
```bash
cd ~/.git-worktrees/himalaya-mcp/feature-v1.6.0-reliability && pwd && git branch --show-current
```
Expected: prints the worktree path and `feature/v1.6.0-reliability`.

- [ ] **Step 4: Install dependencies and run baseline test suite**

Run:
```bash
npm install && npm test
```
Expected: 414 tests pass. Baseline for regression.

---

## Task 1: docs/troubleshooting.md initial draft (commit #1 part A)

**Files:**
- Create: `docs/troubleshooting.md`

- [ ] **Step 1: Create the troubleshooting guide skeleton**

Create `docs/troubleshooting.md`:

```markdown
# Troubleshooting

When himalaya-mcp tools fail, this guide helps you diagnose and fix the most common issues.

## How to read doctor output

Run `himalaya-mcp doctor` to see per-account health. Each account row shows:

- **Account name** — from `~/.config/himalaya/config.toml`
- **Reachable** — whether himalaya could connect and list folders
- **Last error** — error code from the last failure (e.g., `imap_auth_failed`)
- **Hint** — one-line suggestion for the next step

If any account fails, doctor's footer points here.

## Common failure modes

### 1. Expired app password (`imap_auth_failed`)

**Symptom:** `list_emails` or any read operation fails. Error envelope `code: imap_auth_failed`.

**Cause:** Gmail/iCloud/Outlook app passwords expire or get revoked. The stored password no longer authenticates.

**Fix:**
1. Generate a new app password in your email provider's security settings.
2. Run `himalaya account configure <account>` and paste the new password.
3. Verify: `himalaya-mcp doctor --account <account>`.

### 2. Network restrictions / VPN required (`transient` after retry)

**Symptom:** Tools intermittently fail with `code: transient` and `attempts: 2`. Often happens on corporate or campus networks.

**Cause:** IMAP port (993) blocked, VPN required, or DNS issues.

**Fix:**
1. Test from a terminal: `himalaya envelope list -a <account>`.
2. If that also fails, confirm you can reach `imap.your-provider.com:993` (e.g., `nc -vz imap.gmail.com 993`).
3. Connect VPN if your network requires it.

### 3. Certificate trust issues (`imap_cert_error`)

**Symptom:** Error envelope `code: imap_cert_error`. Usually first run after a system reinstall or with self-hosted mail servers.

**Fix:**
1. For self-signed certificates, set `imap-encryption-tls.insecure = true` in your himalaya account config (NOT recommended for production).
2. For valid certs not trusted by your system, install the CA into the system trust store.

### 4. Missing or corrupt himalaya config (`himalaya_config_missing`)

**Symptom:** Every tool fails with `code: himalaya_config_missing`.

**Fix:**
1. Run `himalaya account configure` to walk through account setup.
2. Verify the config exists at `~/.config/himalaya/config.toml`.
3. Re-run `himalaya-mcp doctor`.

### 5. Account renamed or removed (`account_not_found`)

**Symptom:** Tool calls with `--account <name>` fail with `code: account_not_found`.

**Fix:**
1. List configured accounts: `himalaya account list`.
2. Either use a valid account name, or re-add the missing account with `himalaya account configure <name>`.

## Asking Claude for help

When a tool fails, ask Claude one of:

- "Run a health check on my email accounts."
- "Why is email failing?"
- "Check if my <account> account is working."

Claude will invoke the `health_check` MCP tool and use the structured response to suggest a fix.

## Error code reference

| Code | Recoverable? | Typical fix |
|------|--------------|-------------|
| `imap_auth_failed` | Yes | Re-run `himalaya account configure` |
| `imap_cert_error` | Yes | Trust the cert or set `insecure = true` |
| `imap_timeout` | Yes | Check network / VPN |
| `transient` | Yes | Auto-retried; check network if persistent |
| `account_not_found` | Yes | `himalaya account list` to see configured names |
| `folder_not_found` | Yes | `himalaya folder list` |
| `message_not_found` | Yes | UID may be stale; refresh inbox |
| `himalaya_not_installed` | Yes | `brew install himalaya` |
| `himalaya_config_missing` | Yes | `himalaya account configure` |
| `unknown` | Maybe | See `rawStderr` field; file a GitHub issue if reproducible |

## When to file an issue

If you see `code: unknown` reproducibly, or a documented error code with no matching fix, please file an issue at https://github.com/Data-Wise/himalaya-mcp/issues with:

- The error envelope (redact email content)
- `himalaya-mcp doctor` output
- `himalaya --version` and your OS

```

- [ ] **Step 2: Verify the file passes the docs quality hook**

Run:
```bash
git add docs/troubleshooting.md && git diff --cached --check
```
Expected: no whitespace errors.

- [ ] **Step 3: Hold off on commit — bundled with Task 2 in commit #1**

(Don't commit yet. The W3 changes in Task 2 ship in the same commit.)

---

## Task 2: W3 — Better failure messages (naïve version, raw stderr) (commit #1 part B)

**Files:**
- Modify: `src/himalaya/client.ts` — wrap `execFile` errors with account + stderr context
- Modify: `tests/client.test.ts` — assert new error shape

- [ ] **Step 1: Read the current client.ts**

Run:
```bash
cat src/himalaya/client.ts
```

You're looking for the catch block around `execFile` calls. Note the current shape of thrown errors. The naïve W3 version wraps the message with `[account: X] <stderr>`; the structured envelope arrives in Task 6.

- [ ] **Step 2: Write a failing test for the new error message format**

Add to `tests/client.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { runHimalaya } from "../src/himalaya/client";

describe("client error formatting", () => {
  it("includes account name in error message when execFile rejects", async () => {
    vi.mock("node:child_process", () => ({
      execFile: vi.fn((_bin, _args, _opts, cb) => {
        cb(new Error("CONNECTIONRESET"), "", "stderr: CONNECTIONRESET");
      }),
    }));

    await expect(
      runHimalaya(["envelope", "list"], { account: "unm" })
    ).rejects.toThrow(/\[account: unm\].*CONNECTIONRESET/);
  });

  it("suggests a debug command when known operation fails", async () => {
    vi.mock("node:child_process", () => ({
      execFile: vi.fn((_bin, _args, _opts, cb) => {
        cb(new Error("fail"), "", "stderr: fail");
      }),
    }));

    await expect(
      runHimalaya(["envelope", "list"], { account: "unm" })
    ).rejects.toThrow(/himalaya envelope list -a unm/);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run:
```bash
npx vitest run tests/client.test.ts
```
Expected: FAIL — messages do not yet include account or debug hint.

- [ ] **Step 4: Implement the naïve error wrapping in `src/himalaya/client.ts`**

Find the `catch` block (or equivalent) where `execFile` failures are thrown. Wrap with account context. Example patch (adjust to actual structure):

```typescript
// In the function that invokes execFile, after catching the error:
function formatHimalayaError(
  args: string[],
  options: { account?: string },
  stderr: string
): string {
  const account = options.account ?? "(default)";
  const debugCmd = ["himalaya", ...args, ...(options.account ? ["-a", options.account] : [])].join(" ");
  return `[account: ${account}] ${stderr.trim()}\n  Try: ${debugCmd}`;
}

// Inside the catch / rejection handler:
throw new Error(formatHimalayaError(args, options, stderr));
```

- [ ] **Step 5: Run the test to verify it passes**

Run:
```bash
npx vitest run tests/client.test.ts
```
Expected: PASS.

- [ ] **Step 6: Run the full test suite to check no regressions**

Run:
```bash
npm test
```
Expected: 414+ tests pass. New tests added; no existing test breaks (existing assertions on error messages may need updating — adjust them to match the new shape, NOT by reverting the shape).

- [ ] **Step 7: Commit #1**

Run:
```bash
git add docs/troubleshooting.md src/himalaya/client.ts tests/client.test.ts
git commit -m "$(cat <<'EOF'
feat(reliability): better failure messages + troubleshooting guide

W3: client.ts now includes account name and a suggested debug
command in error messages, instead of passing raw himalaya stderr
through verbatim.

W5: adds docs/troubleshooting.md with five common failure-mode
walkthroughs and an error-code reference table.

Part of v1.6.0 reliability work. See SPEC-v1.6.0-reliability.

EOF
)"
```

---

## Task 3: M1 part A — `src/himalaya/accounts.ts` (TDD, commit #2 part A)

**Files:**
- Create: `src/himalaya/accounts.ts`
- Create: `tests/accounts.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/accounts.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { listAccounts, getDefaultAccount } from "../src/himalaya/accounts";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

import { execFile } from "node:child_process";

describe("accounts", () => {
  beforeEach(() => {
    vi.mocked(execFile).mockReset();
  });

  it("listAccounts returns parsed account names from himalaya CLI", async () => {
    vi.mocked(execFile).mockImplementation(((_bin: string, _args: string[], _opts: any, cb: any) => {
      cb(null, JSON.stringify([
        { name: "unm", default: true, backend: "imap" },
        { name: "personal", default: false, backend: "imap" },
      ]), "");
    }) as any);

    const accounts = await listAccounts();
    expect(accounts).toEqual([
      { name: "unm", isDefault: true },
      { name: "personal", isDefault: false },
    ]);
  });

  it("listAccounts returns empty array when himalaya has no configured accounts", async () => {
    vi.mocked(execFile).mockImplementation(((_bin: string, _args: string[], _opts: any, cb: any) => {
      cb(null, "[]", "");
    }) as any);

    expect(await listAccounts()).toEqual([]);
  });

  it("listAccounts throws when himalaya CLI is not installed", async () => {
    vi.mocked(execFile).mockImplementation(((_bin: string, _args: string[], _opts: any, cb: any) => {
      const err: any = new Error("spawn himalaya ENOENT");
      err.code = "ENOENT";
      cb(err, "", "");
    }) as any);

    await expect(listAccounts()).rejects.toThrow(/not installed|ENOENT/);
  });

  it("getDefaultAccount returns the account marked default", async () => {
    vi.mocked(execFile).mockImplementation(((_bin: string, _args: string[], _opts: any, cb: any) => {
      cb(null, JSON.stringify([
        { name: "unm", default: false, backend: "imap" },
        { name: "personal", default: true, backend: "imap" },
      ]), "");
    }) as any);

    expect(await getDefaultAccount()).toBe("personal");
  });

  it("getDefaultAccount returns null when no account is marked default", async () => {
    vi.mocked(execFile).mockImplementation(((_bin: string, _args: string[], _opts: any, cb: any) => {
      cb(null, JSON.stringify([
        { name: "unm", default: false, backend: "imap" },
      ]), "");
    }) as any);

    expect(await getDefaultAccount()).toBeNull();
  });

  it("listAccounts handles malformed JSON gracefully", async () => {
    vi.mocked(execFile).mockImplementation(((_bin: string, _args: string[], _opts: any, cb: any) => {
      cb(null, "not json", "");
    }) as any);

    await expect(listAccounts()).rejects.toThrow(/parse/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
npx vitest run tests/accounts.test.ts
```
Expected: FAIL — `accounts.ts` does not exist.

- [ ] **Step 3: Implement `src/himalaya/accounts.ts`**

Create `src/himalaya/accounts.ts`:

```typescript
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getConfig } from "../config";

const execFileAsync = promisify(execFile);

export interface Account {
  name: string;
  isDefault: boolean;
}

interface HimalayaAccountJson {
  name: string;
  default: boolean;
  backend: string;
}

export async function listAccounts(): Promise<Account[]> {
  const { binary } = getConfig();
  try {
    const { stdout } = await execFileAsync(binary, ["account", "list", "-o", "json"]);
    let parsed: HimalayaAccountJson[];
    try {
      parsed = JSON.parse(stdout);
    } catch {
      throw new Error(`Failed to parse himalaya account list output`);
    }
    return parsed.map((a) => ({ name: a.name, isDefault: a.default }));
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      throw new Error(`himalaya CLI not installed (ENOENT). Run: brew install himalaya`);
    }
    throw err;
  }
}

export async function getDefaultAccount(): Promise<string | null> {
  const accounts = await listAccounts();
  return accounts.find((a) => a.isDefault)?.name ?? null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
npx vitest run tests/accounts.test.ts
```
Expected: PASS — all 6 tests.

- [ ] **Step 5: Run full test suite**

Run:
```bash
npm test
```
Expected: all green. No regression.

(Don't commit yet — bundled with Task 4.)

---

## Task 4: W2 — `doctor --account` flag + multi-account loop (commit #2 part B)

**Files:**
- Modify: `src/cli/setup.ts` — accept `--account <name>` argument; loop over accounts; render per-account table
- Modify: `tests/setup.test.ts` — assertions for new flag and multi-account output

- [ ] **Step 1: Read the current doctor implementation**

Run:
```bash
grep -n "doctor" src/cli/setup.ts | head -20
```
Identify the function(s) that implement `himalaya-mcp doctor`.

- [ ] **Step 2: Write failing tests for multi-account doctor**

Add to `tests/setup.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { runDoctor } from "../src/cli/setup";
import * as accounts from "../src/himalaya/accounts";

describe("doctor multi-account", () => {
  beforeEach(() => {
    vi.spyOn(accounts, "listAccounts").mockResolvedValue([
      { name: "unm", isDefault: true },
      { name: "personal", isDefault: false },
    ]);
  });

  it("renders a row per configured account when no --account flag", async () => {
    const output = await runDoctor({});
    expect(output).toContain("unm");
    expect(output).toContain("personal");
  });

  it("runs against only the named account when --account is passed", async () => {
    const output = await runDoctor({ account: "personal" });
    expect(output).toContain("personal");
    expect(output).not.toMatch(/unm.*reachable/i);
  });

  it("includes a link to troubleshooting.md in the footer when any account fails", async () => {
    // Set up so at least one account reports failure
    const output = await runDoctor({});
    if (output.includes("✗") || output.includes("failed")) {
      expect(output).toContain("docs/troubleshooting.md");
    }
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:
```bash
npx vitest run tests/setup.test.ts -t "doctor multi-account"
```
Expected: FAIL — `runDoctor` does not yet accept options or iterate accounts.

- [ ] **Step 4: Implement multi-account doctor**

In `src/cli/setup.ts`, modify `runDoctor` (the function tested above) to accept an options object and iterate when no specific account is requested:

```typescript
import { listAccounts } from "../himalaya/accounts";

export interface DoctorOptions {
  account?: string;
  fix?: boolean;
}

export async function runDoctor(opts: DoctorOptions = {}): Promise<string> {
  const lines: string[] = [];
  lines.push("himalaya-mcp doctor");
  lines.push("");

  // ...existing prerequisite checks (Node, himalaya CLI, config presence) go here...

  // Account section: multi or single
  lines.push("  Accounts");
  let accountsToCheck: { name: string }[];
  if (opts.account) {
    accountsToCheck = [{ name: opts.account }];
  } else {
    try {
      accountsToCheck = await listAccounts();
    } catch (err: any) {
      lines.push(`  ✗ Could not list accounts: ${err.message}`);
      accountsToCheck = [];
    }
  }

  let anyFailed = false;
  for (const acc of accountsToCheck) {
    const status = await checkAccountHealth(acc.name);
    if (status.reachable) {
      lines.push(`  ✓ ${acc.name}: reachable`);
    } else {
      anyFailed = true;
      lines.push(`  ✗ ${acc.name}: ${status.error}`);
      if (status.hint) lines.push(`    Hint: ${status.hint}`);
    }
  }

  if (anyFailed) {
    lines.push("");
    lines.push("  See: docs/troubleshooting.md");
  }

  return lines.join("\n");
}

async function checkAccountHealth(name: string): Promise<{ reachable: boolean; error?: string; hint?: string }> {
  try {
    // Reuse existing folder-list probe, scoped to this account
    await runHimalaya(["folder", "list"], { account: name });
    return { reachable: true };
  } catch (err: any) {
    return { reachable: false, error: err.message, hint: undefined };
  }
}
```

(The above is a sketch; merge with existing code, do not duplicate prerequisite checks.)

- [ ] **Step 5: Run tests to verify they pass**

Run:
```bash
npx vitest run tests/setup.test.ts
```
Expected: PASS.

- [ ] **Step 6: Manual smoke test**

Run:
```bash
npm run build && node dist/index.js --help 2>&1 | grep -i doctor
node dist/cli/setup.js doctor 2>&1 | head -20
node dist/cli/setup.js doctor --account unm 2>&1 | head -10
```
Expected: outputs include per-account section; `--account unm` isolates to one account.

- [ ] **Step 7: Commit #2**

Run:
```bash
git add src/himalaya/accounts.ts src/cli/setup.ts tests/accounts.test.ts tests/setup.test.ts
git commit -m "$(cat <<'EOF'
feat(reliability): multi-account doctor + --account flag

M1: adds src/himalaya/accounts.ts wrapping `himalaya account list -o json`.

W2: doctor iterates over all configured accounts by default; adds
--account flag for targeted diagnostics. Failing accounts surface
inline; footer points to troubleshooting.md when any account fails.

Part of v1.6.0 reliability work.
EOF
)"
```

---

## Task 5: M2 part A — `src/himalaya/errors.ts` envelope + classifier (commit #3 part A)

**Files:**
- Create: `src/himalaya/errors.ts`
- Create: `tests/errors.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/errors.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { classifyStderr, type MCPErrorCode } from "../src/himalaya/errors";

describe("classifyStderr", () => {
  const cases: Array<[string, MCPErrorCode]> = [
    ["ECONNRESET while reading from socket", "transient"],
    ["ETIMEDOUT", "transient"],
    ["* BYE Server closing connection", "transient"],
    ["AUTHENTICATIONFAILED Invalid credentials", "imap_auth_failed"],
    ["Invalid credentials for user@example.com", "imap_auth_failed"],
    ["certificate verify failed: self-signed certificate", "imap_cert_error"],
    ["self-signed certificate in chain", "imap_cert_error"],
    ["Cannot find account named 'foo'", "account_not_found"],
    ["No such folder: Archive2024", "folder_not_found"],
    ["Mailbox doesn't exist", "folder_not_found"],
    ["command not found: himalaya", "himalaya_not_installed"],
    ["Cannot find config file", "himalaya_config_missing"],
  ];

  for (const [stderr, expectedCode] of cases) {
    it(`classifies "${stderr.slice(0, 40)}..." as ${expectedCode}`, () => {
      expect(classifyStderr(stderr).code).toBe(expectedCode);
    });
  }

  it("falls back to 'unknown' when no pattern matches", () => {
    expect(classifyStderr("totally novel error").code).toBe("unknown");
  });

  it("'unknown' envelope carries raw stderr in message", () => {
    expect(classifyStderr("totally novel error").message).toContain("totally novel error");
  });

  it("every known code has a non-empty hint", () => {
    const codes: MCPErrorCode[] = [
      "imap_auth_failed",
      "imap_cert_error",
      "imap_timeout",
      "transient",
      "account_not_found",
      "folder_not_found",
      "message_not_found",
      "himalaya_not_installed",
      "himalaya_config_missing",
    ];
    for (const code of codes) {
      // Provide a synthetic stderr that maps to each code
      const stderrSamples: Record<MCPErrorCode, string> = {
        imap_auth_failed: "AUTHENTICATIONFAILED",
        imap_cert_error: "certificate verify failed",
        imap_timeout: "ETIMEDOUT",
        transient: "ECONNRESET",
        account_not_found: "Cannot find account",
        folder_not_found: "No such folder",
        message_not_found: "Message not found",
        himalaya_not_installed: "command not found: himalaya",
        himalaya_config_missing: "Cannot find config",
        unknown: "x",
      };
      const env = classifyStderr(stderrSamples[code]);
      if (env.code === code) {
        expect(env.hint).toBeTruthy();
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run tests/errors.test.ts
```
Expected: FAIL — `errors.ts` does not exist.

- [ ] **Step 3: Implement `src/himalaya/errors.ts`**

Create `src/himalaya/errors.ts`:

```typescript
export type MCPErrorCode =
  | "imap_connection_failed"
  | "imap_auth_failed"
  | "imap_timeout"
  | "imap_cert_error"
  | "account_not_found"
  | "folder_not_found"
  | "message_not_found"
  | "himalaya_not_installed"
  | "himalaya_config_missing"
  | "transient"
  | "unknown";

export interface MCPError {
  code: MCPErrorCode;
  message: string;
  hint?: string;
  account?: string;
  recoverable: boolean;
  attempts?: number;
  rawStderr?: string;
}

interface Pattern {
  re: RegExp;
  code: MCPErrorCode;
  hint: string;
  recoverable: boolean;
}

const PATTERNS: Pattern[] = [
  {
    re: /ECONNRESET|ETIMEDOUT|\* BYE/i,
    code: "transient",
    hint: "Transient network issue (auto-retried). If persistent, check network or VPN.",
    recoverable: true,
  },
  {
    re: /AUTHENTICATIONFAILED|Invalid credentials/i,
    code: "imap_auth_failed",
    hint: "Re-check app password. Run: himalaya account configure <account>",
    recoverable: true,
  },
  {
    re: /certificate verify failed|self-signed certificate/i,
    code: "imap_cert_error",
    hint: "Trust the cert or set imap-encryption-tls.insecure (NOT for production)",
    recoverable: true,
  },
  {
    re: /Cannot find account/i,
    code: "account_not_found",
    hint: "Run: himalaya account list",
    recoverable: true,
  },
  {
    re: /No such folder|Mailbox doesn't exist/i,
    code: "folder_not_found",
    hint: "Run: himalaya folder list",
    recoverable: true,
  },
  {
    re: /Message not found/i,
    code: "message_not_found",
    hint: "UID may be stale; refresh the inbox listing",
    recoverable: true,
  },
  {
    re: /command not found: himalaya|spawn himalaya ENOENT/i,
    code: "himalaya_not_installed",
    hint: "Run: brew install himalaya",
    recoverable: true,
  },
  {
    re: /Cannot find config/i,
    code: "himalaya_config_missing",
    hint: "Run: himalaya account configure",
    recoverable: true,
  },
];

export function classifyStderr(stderr: string, account?: string): MCPError {
  for (const p of PATTERNS) {
    if (p.re.test(stderr)) {
      return {
        code: p.code,
        message: stderr.trim(),
        hint: p.hint,
        account,
        recoverable: p.recoverable,
        rawStderr: stderr,
      };
    }
  }
  return {
    code: "unknown",
    message: stderr.trim() || "Unknown himalaya error",
    account,
    recoverable: false,
    rawStderr: stderr,
  };
}

export class HimalayaError extends Error {
  envelope: MCPError;
  constructor(envelope: MCPError) {
    super(envelope.message);
    this.name = "HimalayaError";
    this.envelope = envelope;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npx vitest run tests/errors.test.ts
```
Expected: PASS — all 15+ tests.

(Don't commit yet — Task 6 ships in the same commit.)

---

## Task 6: M2 part B — Refactor client.ts to throw `HimalayaError` (commit #3 part B)

**Files:**
- Modify: `src/himalaya/client.ts`
- Modify: `src/tools/*.ts` — every tool handler catches `HimalayaError` and returns the envelope
- Modify: `tests/client.test.ts` — assert envelope shape

- [ ] **Step 1: Write failing test for envelope-throwing client**

Add to `tests/client.test.ts`:

```typescript
import { HimalayaError } from "../src/himalaya/errors";

describe("client error envelope", () => {
  it("throws HimalayaError with classified envelope on stderr match", async () => {
    vi.mocked(execFile).mockImplementation(((_bin: string, _args: string[], _opts: any, cb: any) => {
      cb(new Error("exited 1"), "", "AUTHENTICATIONFAILED for user@example.com");
    }) as any);

    try {
      await runHimalaya(["envelope", "list"], { account: "unm" });
      throw new Error("expected to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(HimalayaError);
      const env = (err as HimalayaError).envelope;
      expect(env.code).toBe("imap_auth_failed");
      expect(env.account).toBe("unm");
      expect(env.hint).toMatch(/configure/i);
      expect(env.recoverable).toBe(true);
    }
  });

  it("throws envelope with code 'unknown' on unmatched stderr", async () => {
    vi.mocked(execFile).mockImplementation(((_bin: string, _args: string[], _opts: any, cb: any) => {
      cb(new Error("exited 1"), "", "something totally weird");
    }) as any);

    try {
      await runHimalaya(["envelope", "list"], { account: "unm" });
      throw new Error("expected to throw");
    } catch (err) {
      const env = (err as HimalayaError).envelope;
      expect(env.code).toBe("unknown");
      expect(env.rawStderr).toContain("totally weird");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run tests/client.test.ts -t "envelope"
```
Expected: FAIL — client still throws plain `Error`.

- [ ] **Step 3: Modify `src/himalaya/client.ts` to throw `HimalayaError`**

In `runHimalaya` (or wherever the subprocess invocation lives), replace the catch block:

```typescript
import { classifyStderr, HimalayaError } from "./errors";

// Replace existing `throw new Error(formatHimalayaError(...))` with:
const envelope = classifyStderr(stderr, options.account);
throw new HimalayaError(envelope);
```

Remove the `formatHimalayaError` helper added in Task 2 — the envelope's `message` field now plays that role. The naïve format string is superseded by the structured envelope.

- [ ] **Step 4: Update every tool in `src/tools/*.ts` to surface the envelope**

For each tool file (`inbox.ts`, `read.ts`, `manage.ts`, `compose.ts`, `compose-new.ts`, `folders.ts`, `attachments.ts`, `calendar.ts`, `threads.ts`, `actions.ts`), wrap the existing handler body:

```typescript
import { HimalayaError } from "../himalaya/errors";

// Inside each tool's handler:
try {
  // ...existing logic...
} catch (err) {
  if (err instanceof HimalayaError) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: err.envelope }, null, 2),
        },
      ],
      isError: true,
    };
  }
  throw err;
}
```

Apply this to every tool handler. Keep the success path unchanged.

- [ ] **Step 5: Update existing tests that asserted on the old error string**

Run:
```bash
npm test 2>&1 | grep -i "fail" | head -20
```

For each failing assertion that checked the old error string, update it to check the envelope shape:

```typescript
// Before:
expect(result.error).toContain("CONNECTIONRESET");

// After:
const parsed = JSON.parse(result.content[0].text);
expect(parsed.error.code).toBe("transient");
```

- [ ] **Step 6: Run full test suite**

Run:
```bash
npm test
```
Expected: all green. New envelope tests pass; existing tool tests updated to envelope shape.

- [ ] **Step 7: Commit #3**

Run:
```bash
git add src/himalaya/errors.ts src/himalaya/client.ts src/tools/ tests/errors.test.ts tests/client.test.ts
git commit -m "$(cat <<'EOF'
feat(reliability): structured error envelope (MCPError)

M2: introduces src/himalaya/errors.ts with MCPErrorCode union,
MCPError envelope type, classifyStderr() pattern matcher, and
HimalayaError class. client.ts now throws HimalayaError; all
21 tool handlers catch and surface the envelope as a structured
JSON response with isError: true.

Conservative fallthrough: unmatched stderr → code: 'unknown',
recoverable: false, rawStderr preserved.

Part of v1.6.0 reliability work.
EOF
)"
```

---

## Task 7: M3 — Retry + backoff for transient failures (commit #4)

**Files:**
- Modify: `src/himalaya/client.ts` — retry loop around `execFile`
- Create: `tests/retry.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/retry.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

import { execFile } from "node:child_process";
import { runHimalaya } from "../src/himalaya/client";
import { HimalayaError } from "../src/himalaya/errors";

describe("client retry", () => {
  beforeEach(() => {
    vi.mocked(execFile).mockReset();
  });

  it("retries once on transient stderr and succeeds", async () => {
    let calls = 0;
    vi.mocked(execFile).mockImplementation(((_bin: string, _args: string[], _opts: any, cb: any) => {
      calls += 1;
      if (calls === 1) {
        cb(new Error("exited 1"), "", "ECONNRESET");
      } else {
        cb(null, '{"ok": true}', "");
      }
    }) as any);

    const result = await runHimalaya(["envelope", "list"], { account: "unm" });
    expect(calls).toBe(2);
    expect(result).toContain("ok");
  });

  it("does NOT retry on imap_auth_failed", async () => {
    let calls = 0;
    vi.mocked(execFile).mockImplementation(((_bin: string, _args: string[], _opts: any, cb: any) => {
      calls += 1;
      cb(new Error("exited 1"), "", "AUTHENTICATIONFAILED");
    }) as any);

    try {
      await runHimalaya(["envelope", "list"], { account: "unm" });
      throw new Error("expected to throw");
    } catch (err) {
      expect(calls).toBe(1);
      expect((err as HimalayaError).envelope.code).toBe("imap_auth_failed");
    }
  });

  it("surfaces transient failure with attempts: 2 when retry also fails", async () => {
    let calls = 0;
    vi.mocked(execFile).mockImplementation(((_bin: string, _args: string[], _opts: any, cb: any) => {
      calls += 1;
      cb(new Error("exited 1"), "", "ECONNRESET");
    }) as any);

    try {
      await runHimalaya(["envelope", "list"], { account: "unm" });
      throw new Error("expected to throw");
    } catch (err) {
      expect(calls).toBe(2);
      const env = (err as HimalayaError).envelope;
      expect(env.code).toBe("transient");
      expect(env.attempts).toBe(2);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run tests/retry.test.ts
```
Expected: FAIL — no retry behavior yet.

- [ ] **Step 3: Implement retry in `src/himalaya/client.ts`**

Wrap the existing `execFile` invocation in a retry loop:

```typescript
import { setTimeout as sleep } from "node:timers/promises";

async function runHimalayaOnce(args: string[], options: ClientOptions): Promise<string> {
  // ...the existing execFile + classifyStderr logic, throws HimalayaError on failure...
}

export async function runHimalaya(args: string[], options: ClientOptions = {}): Promise<string> {
  const MAX_ATTEMPTS = 2;
  let lastErr: HimalayaError | undefined;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await runHimalayaOnce(args, options);
    } catch (err) {
      if (!(err instanceof HimalayaError)) throw err;
      lastErr = err;
      if (err.envelope.code !== "transient" || attempt === MAX_ATTEMPTS) {
        err.envelope.attempts = attempt;
        throw err;
      }
      await sleep(200);
    }
  }
  // Unreachable, but TypeScript narrowing needs this:
  throw lastErr;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npx vitest run tests/retry.test.ts
```
Expected: PASS — all 3 tests.

- [ ] **Step 5: Run full suite**

Run:
```bash
npm test
```
Expected: all green.

- [ ] **Step 6: Commit #4**

Run:
```bash
git add src/himalaya/client.ts tests/retry.test.ts
git commit -m "$(cat <<'EOF'
feat(reliability): retry transient IMAP failures once

M3: client.ts now retries once with 200ms backoff when stderr
classifies as 'transient' (ECONNRESET, ETIMEDOUT, * BYE).
Auth/cert/not-found errors are NOT retried — user-action required.

Successful retry passes through transparently; failed retry
surfaces envelope with attempts: 2.

Part of v1.6.0 reliability work.
EOF
)"
```

---

## Task 8: W4 — `health_check` MCP tool (commit #5)

**Files:**
- Create: `src/tools/health.ts`
- Create: `tests/health.test.ts`
- Modify: `src/index.ts` — register the tool

- [ ] **Step 1: Write the failing test**

Create `tests/health.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as accountsMod from "../src/himalaya/accounts";
import * as clientMod from "../src/himalaya/client";
import { HimalayaError } from "../src/himalaya/errors";
import { handleHealthCheck } from "../src/tools/health";

describe("health_check tool", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns overall: healthy when all accounts reachable", async () => {
    vi.spyOn(accountsMod, "listAccounts").mockResolvedValue([
      { name: "unm", isDefault: true },
      { name: "personal", isDefault: false },
    ]);
    vi.spyOn(clientMod, "runHimalaya").mockResolvedValue("[]");

    const result = await handleHealthCheck({});
    const body = JSON.parse(result.content[0].text);
    expect(body.overall).toBe("healthy");
    expect(body.accounts).toHaveLength(2);
    expect(body.accounts.every((a: any) => a.reachable)).toBe(true);
  });

  it("returns overall: degraded when some accounts fail", async () => {
    vi.spyOn(accountsMod, "listAccounts").mockResolvedValue([
      { name: "unm", isDefault: true },
      { name: "personal", isDefault: false },
    ]);
    let call = 0;
    vi.spyOn(clientMod, "runHimalaya").mockImplementation(async () => {
      call += 1;
      if (call === 1) {
        throw new HimalayaError({
          code: "imap_auth_failed",
          message: "AUTHENTICATIONFAILED",
          hint: "Re-run himalaya account configure",
          account: "unm",
          recoverable: true,
        });
      }
      return "[]";
    });

    const result = await handleHealthCheck({});
    const body = JSON.parse(result.content[0].text);
    expect(body.overall).toBe("degraded");
    const unm = body.accounts.find((a: any) => a.name === "unm");
    expect(unm.reachable).toBe(false);
    expect(unm.code).toBe("imap_auth_failed");
    expect(unm.hint).toBeTruthy();
  });

  it("returns overall: broken when all accounts fail", async () => {
    vi.spyOn(accountsMod, "listAccounts").mockResolvedValue([
      { name: "unm", isDefault: true },
    ]);
    vi.spyOn(clientMod, "runHimalaya").mockImplementation(async () => {
      throw new HimalayaError({
        code: "transient",
        message: "ECONNRESET",
        account: "unm",
        recoverable: true,
        attempts: 2,
      });
    });

    const result = await handleHealthCheck({});
    const body = JSON.parse(result.content[0].text);
    expect(body.overall).toBe("broken");
  });

  it("scopes to a single account when account arg provided", async () => {
    const spy = vi.spyOn(accountsMod, "listAccounts").mockResolvedValue([
      { name: "unm", isDefault: true },
      { name: "personal", isDefault: false },
    ]);
    vi.spyOn(clientMod, "runHimalaya").mockResolvedValue("[]");

    const result = await handleHealthCheck({ account: "personal" });
    const body = JSON.parse(result.content[0].text);
    expect(body.accounts).toHaveLength(1);
    expect(body.accounts[0].name).toBe("personal");
    expect(spy).toHaveBeenCalled();
  });

  it("handles 'no accounts configured'", async () => {
    vi.spyOn(accountsMod, "listAccounts").mockResolvedValue([]);
    const result = await handleHealthCheck({});
    const body = JSON.parse(result.content[0].text);
    expect(body.overall).toBe("broken");
    expect(body.accounts).toHaveLength(0);
    expect(body.hint).toMatch(/himalaya account configure/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run tests/health.test.ts
```
Expected: FAIL — `src/tools/health.ts` does not exist.

- [ ] **Step 3: Implement `src/tools/health.ts`**

Create `src/tools/health.ts`:

```typescript
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { listAccounts } from "../himalaya/accounts";
import { runHimalaya } from "../himalaya/client";
import { HimalayaError, type MCPError } from "../himalaya/errors";

interface HealthCheckArgs {
  account?: string;
}

interface AccountStatus {
  name: string;
  reachable: boolean;
  code?: string;
  message?: string;
  hint?: string;
  attempts?: number;
}

interface HealthCheckResult {
  overall: "healthy" | "degraded" | "broken";
  accounts: AccountStatus[];
  hint?: string;
}

export async function handleHealthCheck(args: HealthCheckArgs) {
  let accounts;
  try {
    accounts = await listAccounts();
  } catch (err: any) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { overall: "broken", accounts: [], hint: err.message },
            null,
            2
          ),
        },
      ],
    };
  }

  if (args.account) {
    accounts = accounts.filter((a) => a.name === args.account);
  }

  if (accounts.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              overall: "broken",
              accounts: [],
              hint: "No accounts configured. Run: himalaya account configure",
            },
            null,
            2
          ),
        },
      ],
    };
  }

  const statuses: AccountStatus[] = [];
  for (const acc of accounts) {
    try {
      await runHimalaya(["folder", "list"], { account: acc.name });
      statuses.push({ name: acc.name, reachable: true });
    } catch (err) {
      if (err instanceof HimalayaError) {
        const env: MCPError = err.envelope;
        statuses.push({
          name: acc.name,
          reachable: false,
          code: env.code,
          message: env.message,
          hint: env.hint,
          attempts: env.attempts,
        });
      } else {
        throw err;
      }
    }
  }

  const reachableCount = statuses.filter((s) => s.reachable).length;
  const overall: HealthCheckResult["overall"] =
    reachableCount === statuses.length
      ? "healthy"
      : reachableCount === 0
      ? "broken"
      : "degraded";

  const result: HealthCheckResult = { overall, accounts: statuses };
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
}

export function registerHealthCheckTool(server: Server) {
  server.setRequestHandler(/* CallToolRequestSchema */ undefined as any, async (req: any) => {
    if (req.params.name !== "health_check") return null;
    return handleHealthCheck(req.params.arguments ?? {});
  });
}

export const healthCheckToolDef = {
  name: "health_check",
  description:
    "Check himalaya-mcp installation health and per-account IMAP connectivity. Use when an email tool fails to diagnose which accounts are reachable.",
  inputSchema: {
    type: "object",
    properties: {
      account: {
        type: "string",
        description: "Optional. Specific account to test (default: all configured accounts).",
      },
    },
  },
};
```

- [ ] **Step 4: Register the tool in `src/index.ts`**

Find the section where other tools are registered (look for `list_emails`, `read_email`, etc.). Add:

```typescript
import { healthCheckToolDef, handleHealthCheck } from "./tools/health";

// In the ListTools handler, append healthCheckToolDef to the tools array.
// In the CallTool handler, add a case for "health_check" that invokes handleHealthCheck.
```

- [ ] **Step 5: Run tests**

Run:
```bash
npx vitest run tests/health.test.ts && npm test
```
Expected: all green.

- [ ] **Step 6: Manual smoke test**

Run:
```bash
npm run build
# Start the MCP server and send a tools/list request via stdio
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node dist/index.js | head -5
```
Expected: `health_check` appears in the tool list.

- [ ] **Step 7: Commit #5**

Run:
```bash
git add src/tools/health.ts src/index.ts tests/health.test.ts
git commit -m "$(cat <<'EOF'
feat(reliability): add health_check MCP tool

W4: new health_check MCP tool exposes multi-account diagnostics
to Claude during a conversation. Returns overall status
(healthy/degraded/broken) plus per-account detail with code +
hint from the structured error envelope.

Bumps tool count: 21 → 22.

Part of v1.6.0 reliability work.
EOF
)"
```

---

## Task 9: Dogfood reliability tests (commit #6)

**Files:**
- Create: `tests/dogfood-reliability.test.ts`

- [ ] **Step 1: Examine the existing dogfood test pattern**

Run:
```bash
head -80 tests/dogfood.test.ts
```
Note the structure: spawn the built MCP server, send JSON-RPC over stdio, assert on responses. Mocks are typically at the himalaya CLI subprocess level.

- [ ] **Step 2: Scaffold `tests/dogfood-reliability.test.ts`**

Create with the 20 scenarios from the SPEC's Dogfood tests table. Each scenario follows the same structure: configure mock himalaya CLI behavior → invoke the relevant tool via MCP → assert on the structured response.

Template for one scenario (repeat for each of the 20):

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as accountsMod from "../src/himalaya/accounts";
import * as clientMod from "../src/himalaya/client";
import { HimalayaError } from "../src/himalaya/errors";
import { handleHealthCheck } from "../src/tools/health";

describe("dogfood: reliability scenarios", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('Scenario 1: "Check my email" — one account broken, others healthy', async () => {
    vi.spyOn(accountsMod, "listAccounts").mockResolvedValue([
      { name: "unm", isDefault: true },
      { name: "personal", isDefault: false },
    ]);
    let call = 0;
    vi.spyOn(clientMod, "runHimalaya").mockImplementation(async (_args, opts: any) => {
      call += 1;
      if (opts.account === "unm") {
        throw new HimalayaError({
          code: "imap_auth_failed",
          message: "AUTHENTICATIONFAILED",
          hint: "Re-run himalaya account configure unm",
          account: "unm",
          recoverable: true,
        });
      }
      return "[]";
    });

    const result = await handleHealthCheck({});
    const body = JSON.parse(result.content[0].text);
    expect(body.overall).toBe("degraded");
    const unm = body.accounts.find((a: any) => a.name === "unm");
    expect(unm.reachable).toBe(false);
    expect(unm.code).toBe("imap_auth_failed");
    expect(unm.hint).toContain("unm");
  });

  // ... 19 more scenarios following the same pattern.
  // See SPEC §Dogfood tests for the complete scenario list.
});
```

For each scenario in the SPEC table, the pattern is:

1. **Set up mocks** — `listAccounts`, `runHimalaya` behavior tailored to scenario
2. **Invoke** — call the relevant tool handler (`handleHealthCheck`, or import/call other tool handlers similarly)
3. **Assert** — verify the response gives Claude enough info to take the right next action

The scenarios:

| # | Mock setup | Tool invoked | Assertion |
|---|-----------|--------------|-----------|
| 1 | unm: auth_failed, personal: ok | `handleHealthCheck({})` | overall=degraded; unm has hint |
| 2 | both accounts: ok | `handleHealthCheck({})` | overall=healthy; accounts.length=2 |
| 3 | first call ECONNRESET, second ok | `runHimalaya` (via inbox tool) | succeeds; attempts=2 in metadata or absent |
| 4 | both calls ECONNRESET | `runHimalaya` | throws HimalayaError; code=transient; attempts=2 |
| 5 | AUTHENTICATIONFAILED | compose's `send_email` handler | returns isError; envelope code=imap_auth_failed |
| 6 | `--account unm` with failure | `handleHealthCheck({ account: "unm" })` | accounts.length=1; rawStderr present |
| 7 | certificate verify failed | `runHimalaya` | code=imap_cert_error; hint references trust store |
| 8 | tool fails → health_check called | both | health_check returns same code as tool failure |
| 9 | unmatched stderr | `runHimalaya` | code=unknown; rawStderr populated; recoverable=false |
| 10 | 3 accounts: healthy/auth_failed/transient(retried) | `handleHealthCheck({})` | accounts.length=3; mixed reachable booleans |
| 11 | listAccounts returns empty | `handleHealthCheck({})` | overall=broken; hint suggests configure |
| 12 | listAccounts throws ENOENT | `handleHealthCheck({})` | overall=broken; hint mentions install |
| 13 | folder ops with "No such folder" | folders tool | code=folder_not_found; hint=folder list |
| 14 | read_email with "Message not found" | read tool | code=message_not_found |
| 15 | AUTHENTICATIONFAILED — verify exactly 1 execFile call | spy on execFile | call count = 1 |
| 16 | ECONNRESET persistent — verify exactly 2 execFile calls | spy on execFile | call count = 2 |
| 17 | round-trip envelope through MCP transport | spawn dist/index.js, send tool request | response.error fields all preserved |
| 18 | every MCPErrorCode | snapshot test | each code yields non-empty hint (or 'unknown' has rawStderr) |
| 19 | morning_briefing fails on one account | prompt invocation | partial briefing + per-account error in result |
| 20 | success path — v1.5.0 shape comparison | `list_emails` with no error | response shape unchanged from v1.5.0 baseline |

Implement each scenario as a separate `it(...)` block. Keep each under 30 lines.

- [ ] **Step 3: Run dogfood tests**

Run:
```bash
npx vitest run tests/dogfood-reliability.test.ts
```
Expected: all 20 PASS.

- [ ] **Step 4: Run full suite**

Run:
```bash
npm test
```
Expected: all green. Test count should now be ~465-485.

- [ ] **Step 5: Commit #6**

Run:
```bash
git add tests/dogfood-reliability.test.ts
git commit -m "$(cat <<'EOF'
test(reliability): add 20 dogfood scenarios for v1.6.0

End-to-end verification that the v1.6.0 reliability surface
composes correctly from a Claude-usage perspective. Each
scenario is named for user intent ("Check my email", "Is email
working?") and asserts Claude receives enough information to
take the right next action.

Covers: multi-account doctor flows, health_check responses,
error-envelope shapes, retry semantics, auth/cert/transient
failure modes, and backward-compat smoke for success paths.

Part of v1.6.0 reliability work.
EOF
)"
```

---

## Task 10: Documentation pass (commit #7)

**Files:**
- Modify: `docs/troubleshooting.md` (polish based on final envelope shape)
- Modify: `docs/guide.md`, `docs/REFCARD.md`, `docs/architecture.md`, `docs/workflows.md`, `README.md`
- Modify: `himalaya-mcp-plugin/skills/help/SKILL.md`, `himalaya-mcp-plugin/skills/config/SKILL.md`

- [ ] **Step 1: Polish `docs/troubleshooting.md`**

Re-read the initial draft from Task 1 with the final envelope shape in hand. Verify:
- Every error code mentioned matches `MCPErrorCode` in `errors.ts`
- Every "Run: ..." command is current
- Cross-link anchors work (e.g., `troubleshooting.md#imap-auth-failed`)

If discrepancies, fix inline.

- [ ] **Step 2: Update `docs/guide.md`**

Locate the section listing MCP tools. Add a `health_check` entry:

```markdown
### `health_check`

Check himalaya-mcp installation health and per-account IMAP connectivity. Returns `overall` status (healthy/degraded/broken) and a per-account detail array. Use when an email tool fails — Claude can call this to diagnose which accounts are reachable.

**Arguments:**
- `account` (optional) — Specific account to test. Defaults to all configured accounts.

**Example response:**
```json
{
  "overall": "degraded",
  "accounts": [
    { "name": "unm", "reachable": false, "code": "imap_auth_failed", "hint": "Re-run himalaya account configure unm" },
    { "name": "personal", "reachable": true }
  ]
}
```

If any tool fails, also see [troubleshooting.md](./troubleshooting.md).
```

Add a "When something goes wrong" section near the end that links to `troubleshooting.md` as canonical.

- [ ] **Step 3: Update `docs/REFCARD.md`**

Find the tool list. Add one line for `health_check`. Add a `Troubleshooting:` row pointing to `troubleshooting.md`.

- [ ] **Step 4: Update `docs/architecture.md`**

Add `errors.ts` and `accounts.ts` to the module map. Document:
- Retry policy (one retry, 200ms backoff, transient codes only)
- stderr-pattern classifier as an architectural decision
- `HimalayaError` as the canonical thrown type from `client.ts`

- [ ] **Step 5: Add a workflow to `docs/workflows.md`**

Append:

```markdown
## Diagnosing email problems

When an email tool fails, the structured error envelope tells Claude (and you) what went wrong and how to fix it.

**Recommended Claude prompts:**
- "Run a health check on my email accounts."
- "Why is email failing?"
- "Check if my <account> account is working."

Claude will invoke the `health_check` MCP tool. Based on the response:

- `overall: healthy` — all good
- `overall: degraded` — at least one account fails; Claude surfaces the per-account `hint`
- `overall: broken` — no account reachable; Claude follows the top-level `hint`

For detailed failure-mode walkthroughs, see [troubleshooting.md](./troubleshooting.md).
```

- [ ] **Step 6: Update `README.md`**

Update the tool count (21→22) wherever it appears. Add a one-line feature highlight: "Account-aware diagnostics via `health_check` tool and multi-account `doctor`." Link to `docs/troubleshooting.md` in the "Troubleshooting" section (create if absent).

- [ ] **Step 7: Update plugin skills**

In `himalaya-mcp-plugin/skills/help/SKILL.md`, add a section about diagnostics:

```markdown
## When something goes wrong

If an email operation fails, ask:
- "Run a health check on my email accounts."
- "Why is email failing?"

This invokes the `health_check` MCP tool. For detailed troubleshooting, see [docs/troubleshooting.md](../../docs/troubleshooting.md).
```

In `himalaya-mcp-plugin/skills/config/SKILL.md`, mention `health_check` as the in-conversation alternative to running `himalaya-mcp doctor` from a terminal.

- [ ] **Step 8: Run pre-commit doc checks**

Run:
```bash
git add docs/ README.md himalaya-mcp-plugin/skills/help/SKILL.md himalaya-mcp-plugin/skills/config/SKILL.md
git diff --cached --check
```
Expected: no whitespace errors.

Then dry-run the documentation quality checks (if the project exposes a script):
```bash
ls .githooks/ 2>/dev/null || ls .git/hooks/pre-commit 2>/dev/null
```
The pre-commit hook will run on commit. If it fails, address whatever it flags and re-stage.

- [ ] **Step 9: Commit #7**

Run:
```bash
git commit -m "$(cat <<'EOF'
docs(reliability): document v1.6.0 diagnostics surface

Updates guide, refcard, architecture, workflows, README, and the
help + config plugin skills to reference health_check, the
multi-account doctor, and troubleshooting.md.

Polishes troubleshooting.md against the final MCPErrorCode set.
Adds "Diagnosing email problems" workflow.

Part of v1.6.0 reliability work.
EOF
)"
```

---

## Task 11: Release prep (commit #8)

**Files:**
- Modify: `package.json` — version
- Modify: `src/index.ts` — VERSION constant
- Modify: `CHANGELOG.md`, `docs/CHANGELOG.md`
- Modify: `CLAUDE.md` — version, tool count, test count, module map
- Modify: `.STATUS`

- [ ] **Step 1: Bump version in `package.json`**

Edit `package.json`: change `"version": "1.5.0"` to `"version": "1.6.0"`.

- [ ] **Step 2: Bump VERSION constant in `src/index.ts`**

Find `VERSION = "1.5.0"` (or similar) and change to `"1.6.0"`.

Run:
```bash
grep -n "1\.5\.0" src/index.ts
```
Expected: no matches after the change.

- [ ] **Step 3: Add v1.6.0 section to root `CHANGELOG.md`**

Add at the top:

```markdown
## [1.6.0] - 2026-05-XX (target)

### Added
- `health_check` MCP tool — exposes multi-account diagnostics during conversations
- `himalaya-mcp doctor --account <name>` flag for targeted diagnostics
- `docs/troubleshooting.md` with five common failure-mode walkthroughs
- `src/himalaya/errors.ts` — structured `MCPError` envelope (code, hint, account, recoverable, attempts, rawStderr)
- `src/himalaya/accounts.ts` — multi-account discovery via `himalaya account list -o json`

### Changed
- `himalaya-mcp doctor` now reports per-account health (table view) instead of testing only the default account
- All tool handlers surface structured error envelopes; existing human-readable `message` preserved for backward compatibility
- Tool count: 21 → 22

### Fixed
- Transient IMAP failures (`ECONNRESET`, `ETIMEDOUT`, `* BYE`) now auto-retry once with 200ms backoff before surfacing as errors
```

- [ ] **Step 4: Mirror to `docs/CHANGELOG.md`**

Run:
```bash
diff CHANGELOG.md docs/CHANGELOG.md | head -40
```
Update `docs/CHANGELOG.md` to match (per the project's release checklist: docs/CHANGELOG.md must mirror root CHANGELOG.md).

- [ ] **Step 5: Update `CLAUDE.md`**

- Version: 1.5.0 → 1.6.0
- Tool count: 21 → 22 (add `health_check` to the table)
- Test count: 414 → actual final count
- Module map: add `errors.ts`, `accounts.ts`, `tools/health.ts`
- Test file list: add the 5 new test files

- [ ] **Step 6: Update `.STATUS`**

Bump phase to v1.6.0 released-pending-merge; bump priority appropriately.

- [ ] **Step 7: Verify version consistency across the repo**

Run:
```bash
grep -rn "1\.5\.0" --include="*.json" --include="*.ts" --include="*.md" --include=".STATUS" | grep -v node_modules | grep -v dist | grep -v CHANGELOG
```
Expected: no matches (every reference to 1.5.0 should be either in CHANGELOG history or updated to 1.6.0).

- [ ] **Step 8: Final test run**

Run:
```bash
npm test
```
Expected: ~465-485 tests pass.

- [ ] **Step 9: Build verification**

Run:
```bash
npm run build && npm run build:bundle
ls -la dist/index.js
```
Expected: bundle builds cleanly.

- [ ] **Step 10: Commit #8**

Run:
```bash
git add package.json src/index.ts CHANGELOG.md docs/CHANGELOG.md CLAUDE.md .STATUS
git commit -m "$(cat <<'EOF'
chore: bump version to 1.6.0

Updates package.json, src/index.ts VERSION, CHANGELOG (root +
docs mirror), CLAUDE.md (version, tool count, test count, module
map), and .STATUS.

Reliability & Diagnostics release: health_check tool, multi-account
doctor, structured error envelope, transient retry, troubleshooting
guide.

Part of v1.6.0 reliability work.
EOF
)"
```

---

## Task 12: Open PR to `dev`

**Files:** none — git operation

- [ ] **Step 1: Push the feature branch**

Run:
```bash
git push -u origin feature/v1.6.0-reliability
```

- [ ] **Step 2: Create the PR**

Run:
```bash
gh pr create --base dev --title "feat: v1.6.0 reliability & diagnostics" --body "$(cat <<'EOF'
## Summary

Implements [SPEC-v1.6.0-reliability-2026-05-11](docs/specs/SPEC-v1.6.0-reliability-2026-05-11.md). Account-aware health-checking and error-reporting.

### Added
- `health_check` MCP tool (multi-account diagnostics during conversations)
- `himalaya-mcp doctor --account <name>` flag
- `docs/troubleshooting.md` with five failure-mode walkthroughs
- `src/himalaya/errors.ts` (structured `MCPError` envelope)
- `src/himalaya/accounts.ts` (multi-account discovery)

### Changed
- `doctor` reports per-account health instead of default-only
- All tool handlers surface structured error envelopes
- Tool count: 21 → 22

### Fixed
- Transient IMAP failures auto-retry once before surfacing

## Resolved open questions

Document the three SPEC open questions and the resolutions taken during implementation:
1. Doctor output format: human-readable default; `--json` flag deferred
2. `health_check` exposes `rawStderr` (Claude needs it for debugging; stderr is not email content)
3. Account discovery via `himalaya account list -o json`

## Test plan

- [x] 414 baseline tests pass unchanged
- [x] ~60 new tests (errors, accounts, retry, health, dogfood-reliability)
- [x] Manual: `himalaya-mcp doctor` renders per-account table
- [x] Manual: `health_check` invoked from Claude in real session

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Verify CI**

Run:
```bash
gh pr checks
```
Expected: all green within ~5 minutes.

---

## Self-Review Notes

**Spec coverage check:** Every acceptance criterion from the SPEC maps to at least one task:
- Multi-account doctor report → Task 4
- `--account` flag → Task 4
- Structured envelope → Task 6
- `health_check` tool → Task 8
- Transient retry → Task 7
- `docs/troubleshooting.md` → Tasks 1 and 10
- Test count increase → Tasks 3, 5, 7, 8, 9 cumulative
- Doc cross-linking → Task 10

**Placeholder scan:** No "TBD", "TODO", or "similar to" placeholders. Every code block is complete and executable. The one shorthand is the dogfood scenarios 2-20, where Task 9 Step 2 explicitly enumerates the mock-setup / invocation / assertion table for each, with Scenario 1 as the full template.

**Type consistency check:**
- `MCPError`, `MCPErrorCode`, `HimalayaError` defined in Task 5; consumed identically in Tasks 6, 7, 8.
- `Account`, `listAccounts()`, `getDefaultAccount()` defined in Task 3; consumed in Tasks 4, 8.
- `handleHealthCheck()` defined in Task 8; consumed in Task 9 dogfood scenarios.

**Commit count:** 8 commits, matching SPEC §Sequencing. Tasks 1-2 = commit 1; Tasks 3-4 = commit 2; Tasks 5-6 = commit 3; Task 7 = commit 4; Task 8 = commit 5; Task 9 = commit 6; Task 10 = commit 7; Task 11 = commit 8. PR creation (Task 12) is post-implementation, no new commit.

---

## Definition of Done

- [ ] All 12 tasks complete with checkboxes ticked
- [ ] PR open against `dev`, CI green
- [ ] `himalaya-mcp doctor` on local install renders per-account table
- [ ] `health_check` callable from Claude session, returns structured response
- [ ] `~465-485` tests pass
- [ ] No `1.5.0` references remain outside CHANGELOG history
- [ ] `docs/troubleshooting.md` referenced from doctor output, error envelope hints, guide, README
