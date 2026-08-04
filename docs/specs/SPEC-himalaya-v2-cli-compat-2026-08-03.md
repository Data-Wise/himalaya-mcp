# Spec: himalaya CLI v1.x/v2.x Dual Compatibility Fix

**Status:** Draft — awaiting human review
**Precursor:** [BUG-himalaya-v2-cli-incompatibility-2026-08-03.md](BUG-himalaya-v2-cli-incompatibility-2026-08-03.md)
(reproduction evidence, root cause, exact broken lines — read that first)

## Assumptions I'm making

1. Work happens on a `feature/*` worktree branched from `dev` — this is code, not docs, and
   `dev` blocks new/modified code files per the branch-protection table in `CLAUDE.md`.
2. "Fix the bug" means restore full functionality against `himalaya 2.0.0` (current Homebrew
   stable) **while continuing to support himalaya v1.x** — this is now a dual-syntax client,
   not a cutover. *(Confirmed by user 2026-08-03 — reverses the original bug report's
   cutover-only Quick Wins.)*
3. `create_folder`/`delete_folder` on v2: shell to `himalaya imap create`/`himalaya imap delete`
   and return a clean structured error (not a raw CLI crash) for non-IMAP accounts. On v1.x,
   keep the existing `folder create`/`folder delete` path unchanged — it already works.
   *(Confirmed by user 2026-08-03.)*
4. Scope includes CLI version detection/gating in `doctor`, not just the immediate fix — but
   the gate now reports the *detected* version and which syntax branch is in use, rather than
   failing v1.x as unsupported. *(Confirmed by user 2026-08-03.)*
5. IMAP-vs-non-IMAP detection reuses the existing `backends` field already parsed (but not yet
   exposed) in `src/himalaya/accounts.ts` — no new discovery mechanism.
6. No new runtime dependencies. This is CLI-arg/control-flow changes, one new error code, and
   one new small version-detection module — no new libraries.
7. Version detection happens once per `HimalayaClient` instance (cache the result — don't shell
   out to `himalaya --version` on every single tool call) and is lazy: only triggered on first
   `exec()`, not at construction, so client instantiation stays synchronous and side-effect-free.
8. "v1.x" here means "the syntax this codebase was already written against" (`folder`,
   `--output json`) — I'm not assuming a specific v1 minor; the branch is really "old syntax vs
   `--json`/`mailbox` syntax," detected by whether the major version parsed from `himalaya
   --version` is `>= 2`.

→ Correct me now or I'll proceed with these.

## Objective

Restore full himalaya-mcp functionality against himalaya CLI v2.0.0 (Homebrew's current
stable release) **without dropping support for the v1.x syntax the codebase already targets**,
and stop the next himalaya CLI breaking change from causing a silent, total, hard-to-diagnose
outage the way this one did.

Today, **every** MCP tool call fails before reaching IMAP on v2, because
`HimalayaClient.execOnce()` unconditionally appends a flag (`--output json`) the v2 CLI rejects
outright. This is not a config or account issue — `himalaya envelope list --json` against the
affected account returns real inbox data immediately. Any user who ran a fresh
`brew install himalaya` today hits this 100% of the time; users still pinned to v1.x are
unaffected today and must stay unaffected after this fix.

Success = a user on **either** `himalaya 2.0.0` or a v1.x install can use every currently-passing
MCP tool exactly as before, `create_folder`/`delete_folder` work on IMAP accounts on both CLI
generations and fail cleanly (not crash) on non-IMAP accounts on v2, and `himalaya-mcp doctor`
reports the detected CLI version and which syntax branch it's using — so a *future* breaking CLI
change (a hypothetical v3) still surfaces as a named, actionable diagnostic instead of silent
tool failures.

## Tech Stack

TypeScript 5.7+, Node 22+, `node:child_process` (`execFile`), Vitest, MCP SDK
`@modelcontextprotocol/sdk`. No new dependencies.

## Commands

```
Build:        npm run build
Bundle:       npm run build:bundle
Test:         npm test                    # vitest run, 619 tests / 33 files today
Test (watch): npm test:watch
Lint:         npm run lint                # tsc (no separate linter)
Dev:          npm run dev                 # tsc --watch
Doctor:       node dist/cli/index.js doctor --json
```

Per **`pre-pr-testing.md`** (global rule): this is a code change → minimum tier is the **full
suite**, run in the worktree's own path, not the main checkout. New behavior (version gating,
folder create/delete error path) requires new/changed tests — not just updated string literals
in existing ones.

## Project Structure (files this touches)

```
src/himalaya/cli-version.ts  → NEW: detect + cache installed himalaya major version, shared by
                                client.ts and doctor.ts (single source of truth)
src/himalaya/client.ts       → core fix: branch arg-building on detected version (--json vs
                                --output json, mailbox vs folder, imap create/delete vs
                                folder create/delete)
src/himalaya/errors.ts       → new MCPErrorCode for "unsupported backend" (folder create/delete
                                on a non-IMAP v2 account)
src/himalaya/accounts.ts     → expose `backends` on the Account type (already parsed, unused)
src/cli/doctor.ts            → checkPrerequisites(): report detected version + syntax branch,
                                only fail on a genuinely unrecognized/unparseable version
tests/client.test.ts         → mocked exec() assertions parameterized over both version branches
tests/cli-version.test.ts    → NEW: unit tests for the version-detection/parsing module
tests/folders.test.ts        → new tests for the IMAP-only create/delete error path (v2) and
                                the unchanged v1.x folder create/delete path
tests/health.test.ts / doctor tests → new test asserting doctor reports the detected branch
docs/getting-started/installation.md, desktop-extension.md, diagnose-issues.md
                              → document that examples use v2 syntax; note v1.x still supported
CLAUDE.md                    → note both supported himalaya CLI generations and the branch point
```

No new files/directories beyond `src/himalaya/cli-version.ts`, `tests/cli-version.test.ts`,
this spec, and its precursor bug report.

## Code Style

Match what's already in `client.ts` — small focused private helpers, JSDoc explaining *why*
(not what) above non-obvious lines, structured errors via `HimalayaError`/`classifyStderr`
rather than throwing raw strings. Example of the target style (the existing `applyFolderArg`):

```typescript
// Resolve the effective folder, validate it, and append --folder to `args`
// if it differs from the implicit INBOX default. Returns the effective folder.
private applyFolderArg(args: string[], folder: string | undefined): string {
  const f = folder || this.opts.folder;
  if (f && f.toUpperCase() !== "INBOX") {
    assertSafeArg(f, "folder");
    args.push("--folder", f);
  }
  return f;
}
```

## Testing Strategy

- **Unit (Vitest, mocked `execFileAsync`):** primary coverage today — assert on the exact args
  array built for each client method, **parameterized over both a v1.x-style and a v2.x-style
  mocked `himalaya --version` response** so every existing test effectively doubles (old syntax
  still asserted, new syntax newly asserted) rather than being replaced.
- **`cli-version.ts` unit tests:** pure parsing/branching logic — feed it real `--version`
  output strings captured from both CLI generations (e.g. the exact
  `himalaya v2.0.0 +gmail +jmap...` string from the bug report), plus malformed/unexpected
  output, assert the correct branch decision and that it's cached (not re-shelled every call).
- **CI-wired argv smoke test (fake binary):** the bug report notes all 619 existing tests mock
  `execFileAsync` directly, so none of them ever exercised real argv — they assert on the args
  *this repo* builds, not on whether a real CLI would accept them. Add a fake `himalaya`
  executable fixture (`tests/fixtures/fake-himalaya/`) that pattern-matches expected v1/v2 argv
  and rejects anything else the way the real CLI does; point `HIMALAYA_BINARY` at it in a
  dedicated test file run in CI. This is a real subprocess spawn (no mocking) — it catches
  "the code sends an argv the CLI doesn't recognize" even without live IMAP.
- **Local-only live check:** a separate opt-in test (`HIMALAYA_MCP_LIVE_TEST=1`) runs against
  the real installed binary + a real account, for manual pre-ship confidence — not part of the
  CI gate.
- **Doctor test:** assert `checkPrerequisites()` reports the detected major version and which
  syntax branch is active, and only reports `fail` (not `warn`) when the version string is
  unparseable/unrecognized — v1.x is a supported `pass`, not a deprecation warning.
- Coverage bar: don't lower it. Every changed/added branch (v1 vs v2 syntax, IMAP vs non-IMAP
  create/delete, parseable vs unparseable CLI version) needs a covering test — no "trust me"
  branches.

## Boundaries

- **Always do:** run the full test suite in the worktree before opening a PR (per
  `pre-pr-testing.md`); update every doc example alongside the code that changes it; keep the
  structured-error pattern (no bare thrown strings).
- **Ask first:** anything not in this spec's scope — e.g. don't also refactor `client.ts`'s
  retry logic or touch unrelated tools while in this file; don't bump the package version or
  open a release PR as part of this fix (that's a separate, later step).
- **Never do:** commit secrets/tokens found in test fixtures; silently drop the mocked-test
  suite in favor of only the live smoke test; remove or weaken an existing passing test to make
  this change land faster.

## Success Criteria

1. `himalaya envelope list`, `search`, `read`, `flag`, `move`, `account list` all work
   end-to-end against real `himalaya 2.0.0` (manually verified once, not just mocked).
2. `list_folders` works against real `himalaya 2.0.0` (`mailbox list`), **and** the equivalent
   v1.x-syntax path (`folder list --output json`) is unchanged and still covered by tests.
3. `create_folder`/`delete_folder` work against a real IMAP account via `himalaya imap
   create`/`himalaya imap delete` on v2, and via the existing `folder create`/`folder delete`
   on v1.x.
4. `create_folder`/`delete_folder` against a non-IMAP-backend account **on v2** return a
   structured `MCPError` (new code, e.g. `unsupported_backend`) with a clear hint — not a raw
   CLI stack trace / unhandled rejection.
5. `himalaya-mcp doctor` reports the detected himalaya major version and which syntax branch
   (v1/v2) is in use for `pass`, and only reports `fail` when the version string can't be parsed
   at all (CLI present but `--version` output unrecognized).
6. Version detection is cached per `HimalayaClient` instance — verified by a test asserting
   `himalaya --version` is shelled out at most once across multiple `exec()` calls.
7. Full test suite green (`npm test`), including new tests for items 3–6.
8. `npm run build` and `npm run build:bundle` succeed.
9. Doc examples clearly state which CLI generation's syntax they show, and no doc claims
   `--output json`/`folder list` is the *only* supported form when v1.x support is retained.
10. `CLAUDE.md` documents both supported himalaya CLI generations and how the branch is detected.

## Adversarial Review Findings (2026-08-03) — incorporated below

Two independent reviewers (code-quality, security) audited this spec before Phase 2. Findings
folded into the design (see updated sections):

- **[CRITICAL, code-review — RESOLVED 2026-08-03 with live verification]**
  `imap create`/`imap delete` semantics vs v1's `folder create`/`folder delete` were asserted,
  not verified. Verified live against the real UNM IMAP account (throwaway folder, created then
  deleted, cleaned up):
  ```
  $ himalaya imap create "himalaya-mcp-spec-verify-DELETE-ME"
  Mailbox successfully created
  $ himalaya mailbox list --json | grep spec-verify
  "himalaya-mcp-spec-verify-DELETE-ME"          # confirmed present
  $ himalaya imap delete "himalaya-mcp-spec-verify-DELETE-ME"
  Mailbox successfully deleted
  $ himalaya mailbox list --json | grep spec-verify
  (no output — confirmed removed)
  ```
  Basic create/list/delete round-trip confirmed working as expected. **Also confirmed the
  namespace-safety concern below is real, not theoretical**: a `/`-containing name creates a
  genuine nested mailbox in the account's real hierarchy —
  ```
  $ himalaya imap create "himalaya-mcp-spec-verify-DELETE-ME/nested-child"
  Mailbox successfully created
  $ himalaya mailbox list --json | grep spec-verify
  "himalaya-mcp-spec-verify-DELETE-ME"
  "himalaya-mcp-spec-verify-DELETE-ME/nested-child"   # a real nested mailbox, not rejected/escaped
  ```
  (both cleaned up via `imap delete` immediately after). This confirms the MEDIUM finding below
  isn't speculative — `imap create`/`imap delete` will happily act on `/`-separated hierarchy
  paths, so the namespace-character check is a required part of this spec, not a nice-to-have.
- **[HIGH, security]** Version detection had no stated timeout — a hung/misbehaving
  `HIMALAYA_BINARY` would stall the *first* tool call on a fresh client instance for up to the
  full command timeout (120s default). Needs its own short, independent timeout + defined
  failure path.
- **[HIGH, security]** `backends` is not actually exposed on the `Account` type today (only
  `name`/`isDefault` — `backend?`/`backends?` exist on the raw parsed JSON but are dropped).
  The spec's assumption #5 overstated this as "already exposed." More importantly: the failure
  mode for missing/malformed/unrecognized `backends` was unspecified — must **fail closed**
  (`unsupported_backend`), never assume IMAP and proceed.
- **[MEDIUM, security]** `assertSafeArg` only blocks flag-smuggling (`-`-prefixed values) — it
  doesn't restrict `/`, `#`, or leading `.`, which matter more once names flow into raw IMAP
  CREATE/DELETE (RFC 3501) than they did through the removed shared/backend-agnostic API. An
  LLM-composed folder name reaching this MCP server could target an unintended namespace.
- **[MEDIUM, security]** The CI fixture's expected-argv patterns risk asserting the same wrong
  assumption the implementation makes (self-confirmation), and didn't originally cover the
  negative path (inputs that should be rejected client-side and never reach the subprocess).
- **[LOW×2]** `unsupported_backend` must be raised as a pre-flight client-side check (before
  shelling out), not parsed from stderr — sidesteps any risk of colliding with the `transient`
  retry-classification regex. Fixture binary construction must not shell-eval argv.

## Resolved Design Decisions (confirmed by user, 2026-08-03)

1. **New `MCPErrorCode`:** `unsupported_backend` — generic, reusable if a future operation
   hits a different backend-capability gap, not scoped to just folder create/delete.
2. **Version parsing:** plain regex extracting the leading `v(\d+)` from `himalaya --version`
   output (e.g. `himalaya v2.0.0 +gmail +jmap...` → major `2`). No new dependency.
3. **Doctor caching:** `cli-version.ts` exports a plain `detectHimalayaVersion()` function with
   **no module-level cache**. `HimalayaClient` does its own per-instance caching (a private
   field, populated lazily on first `exec()`). `doctor` calls the same exported function fresh
   each run — it's a one-shot CLI invocation in its own process, so there's nothing to share.
4. **Smoke test scope — wired into CI, not just local-only.** CI has no real IMAP account, so
   this can't hit a live mailbox. Instead: a **fake `himalaya` binary** (a small Node script,
   `execFile`-style argv matching internally — no shell string interpolation) checked into
   `tests/fixtures/fake-himalaya/` that recognizes the exact argv patterns `HimalayaClient` is
   expected to send for both v1 and v2 syntax (`envelope list --json`, `mailbox list --json`,
   `folder list --output json`, `imap create <name>`, etc. — **sourced from the bug report's
   live-reproduction transcripts, not re-derived from reading the new client code**, to avoid
   the fixture and the implementation silently sharing the same wrong assumption), echoes back
   canned JSON for recognized calls, and **exits non-zero with `unrecognized subcommand`-style
   output for anything else**. The fixture also needs **negative-path cases**: inputs that
   `assertSafeArg`/the new namespace-character check should reject client-side — asserting the
   fixture binary is never invoked at all for those, not just that it would reject them if
   reached. Point `HIMALAYA_BINARY` at this fixture in a CI-only test job. A second, separate
   opt-in local test (`HIMALAYA_MCP_LIVE_TEST=1`) still exists for a one-time manual check
   against a real installed binary + real account before shipping — the CI fixture is the
   regression guard, the manual test is pre-flight confidence.
5. **Version-detection timeout, independent of command timeout.** `detectHimalayaVersion()`
   gets its own short timeout (5s, not the 120s default command timeout) so a hung/misbehaving
   `HIMALAYA_BINARY` stalls the version probe briefly, not the whole first tool call. On timeout
   or unparseable/empty `--version` output: fail closed with a distinct, named error (not a
   silent default to v1 or v2 syntax, and not a generic "unknown" error) — the caller needs to
   know version detection itself failed, separate from a real command failing.
6. **IMAP-backend detection fails closed.** `Account.backends` must actually be added to the
   `Account` type (it's parsed into the raw JSON today but dropped before reaching callers —
   correcting an inaccurate assumption in this spec's original draft). If `backends` is
   missing, empty, or contains no recognized value: `create_folder`/`delete_folder` return
   `unsupported_backend` immediately — **never** fall through to attempting `imap create`/
   `imap delete` against an unconfirmed backend. This check happens client-side, before any
   subprocess is spawned (not by classifying CLI stderr), which also means `unsupported_backend`
   can't collide with the `transient` retry-classification pattern in `errors.ts`.
7. **Namespace-safety check for `imap create`/`imap delete` names**, layered on top of the
   existing `assertSafeArg` flag-smuggling check (which stays as-is for the v1 `folder`
   path): reject `name` values containing `/`, `#`, or a leading `.` before they reach the raw
   IMAP CREATE/DELETE commands, since those commands have no backend-agnostic abstraction
   softening cross-namespace effects the way the removed shared API did.
