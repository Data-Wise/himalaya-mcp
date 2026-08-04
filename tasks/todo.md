# Tasks: himalaya CLI v1.x/v2.x Dual Compatibility Fix

Plan: [tasks/plan.md](plan.md) · Spec: [docs/specs/SPEC-himalaya-v2-cli-compat-2026-08-03.md](../docs/specs/SPEC-himalaya-v2-cli-compat-2026-08-03.md)

Execute on a `feature/*` worktree branched from `dev` (per spec assumption #1 — this is code).

## Phase A — foundations (parallelizable, no interdependencies)

- [x] **T1: `cli-version.ts` — version detection module**
  - Acceptance: exports `detectHimalayaVersion()`; regex-extracts leading `v(\d+)` major from
    `himalaya --version` stdout; own 5s timeout independent of command timeout; on
    timeout/empty/unparseable output, throws/returns a distinct, named failure (not silently
    defaulting to v1 or v2, not a generic "unknown" error); no module-level cache (per spec
    Resolved Decision #3).
  - Verify: `npm test -- cli-version` — covers a real v2.0.0 string, a plausible v1.x string, a
    dev/git-rev build with no `v` prefix, empty stdout, and a deliberately slow-responding fake
    process to prove the 5s timeout actually fires.
  - Files: `src/himalaya/cli-version.ts`, `tests/cli-version.test.ts`

- [x] **T2: `errors.ts` — `unsupported_backend` error code**
  - Acceptance: `MCPErrorCode` union gains `"unsupported_backend"`; a helper/constructor to
    raise it client-side (pre-flight, not via `classifyStderr`); confirm its use never risks
    matching the existing `transient` pattern's regex (per LOW finding).
  - Verify: `npm test -- errors` — existing tests unchanged/still green, new test for the added
    code's shape and `recoverable: false`.
  - Files: `src/himalaya/errors.ts`, `tests/errors.test.ts`

- [x] **T3: `accounts.ts` — expose `backends`, add `isImapAccount()`**
  - Acceptance: `Account` type gains `backends?: string[]`; `listAccounts()` populates it from
    the raw JSON's `backend`/`backends` fields (singular v1-style or plural v2-style); new
    `isImapAccount(account)` returns `false` (fail-closed) when `backends` is missing, empty, or
    contains no recognized IMAP value — never defaults to `true`.
  - Verify: `npm test -- accounts` — explicit cases for present/absent/empty/malformed
    `backends`, both singular and plural raw-JSON shapes.
  - Files: `src/himalaya/accounts.ts`, `tests/accounts.test.ts`

- [x] **T7a: CI argv fixture — content only (no wiring yet)**
  - Acceptance: `tests/fixtures/fake-himalaya/` script (Node, `execFile`-style internal argv
    matching — no shell-string interpolation) recognizing the exact argv patterns captured in
    the bug report's live transcripts (`envelope list --json`, `mailbox list --json`,
    `folder list --output json`, `account list --json`, `imap create <name>`,
    `imap delete <name>`), echoing canned JSON per pattern, exiting non-zero with
    `unrecognized subcommand`/`unexpected argument`-style stderr for anything unmatched.
    **Written from `docs/specs/BUG-himalaya-v2-cli-incompatibility-2026-08-03.md`'s transcripts
    — not from reading T4/T5's implementation, which doesn't exist yet.**
  - Verify: run the fixture script directly with a few hand-typed argv combinations, confirm
    expected stdout/exit codes — no test harness wiring required yet (that's T7b).
  - Files: `tests/fixtures/fake-himalaya/` (script + any small fixture data files)

## Phase B — core implementation (sequential, depends on Phase A)

- [x] **T4: `client.ts` — dual-syntax `execOnce()`/`listFolders()`** *(needs T1)*
  - Acceptance: `HimalayaClient` lazily calls `detectHimalayaVersion()` on first `exec()`,
    caches the result on the instance (not module-level); `execOnce()` appends `--json` on v2,
    `--output json` on v1; `listFolders()` sends `["mailbox","list"]` on v2,
    `["folder","list"]` on v1; a version-detection failure surfaces as its own distinct error
    (not retried by the `MAX_ATTEMPTS` command-retry loop as if it were a transient command
    failure).
  - Verify: `npm test` (full suite) — every existing client test parameterized over both a
    mocked v1-style and v2-style `--version` response; this is the highest-blast-radius single
    change, so the full suite (not just `client.test.ts`) must be green before starting T5.
  - Files: `src/himalaya/client.ts`, `tests/client.test.ts`

- [x] **T5: `client.ts` — `createFolder()`/`deleteFolder()` dual-path + namespace safety**
  *(needs T1, T2, T3, T4)*
  - Acceptance: v1.x path unchanged (`folder create`/`folder delete`, still using the existing
    `assertSafeArg`). v2 path: (a) call `isImapAccount()` first — if false/unknown, return
    `unsupported_backend` immediately, **no subprocess spawned**; (b) reject `name` containing
    `/`, `#`, or a leading `.` before calling `imap create`/`imap delete` (layered on top of,
    not replacing, `assertSafeArg`); (c) on a confirmed-IMAP account with a safe name, shell to
    `himalaya imap create <name>` / `himalaya imap delete <name>`.
  - Verify: `npm test -- folders client` — explicit five-branch matrix: (1) IMAP + safe name →
    success, (2) non-IMAP backend → `unsupported_backend`, no subprocess call asserted, (3)
    missing `backends` → `unsupported_backend`, no subprocess call, (4) malformed `backends` →
    `unsupported_backend`, no subprocess call, (5) IMAP + `/`-or-`#`-or-leading-`.` name →
    rejected before the subprocess call. Five branches, five separate test cases — no combined
    "handles bad input" catch-all.
  - Files: `src/himalaya/client.ts`, `tests/folders.test.ts`

- [x] **T6: `doctor.ts` — version/branch reporting** *(needs T1)*
  - Acceptance: `checkPrerequisites()` calls `detectHimalayaVersion()` once per doctor run
    (not once per check), reports the major version and which syntax branch (v1/v2) is active
    as `pass` for any parseable version, `fail` only when the version string is genuinely
    unparseable/unrecognized (not a deprecation warning for v1.x).
  - Verify: doctor-specific test file green; manual `node dist/cli/index.js doctor` run against
    the real installed `himalaya 2.0.0`, confirm output names the v2/mailbox branch.
  - Files: `src/cli/doctor.ts`, doctor's test file (confirm exact filename when starting this task)

## Phase C — integration + docs

- [x] **T7b: Wire the CI fixture into a real test file** *(needs T4, T5)*
  - Acceptance: new test file points `HIMALAYA_BINARY` at `tests/fixtures/fake-himalaya/` and
    exercises the real `HimalayaClient` (not mocked `execFileAsync`) against it — a genuine
    subprocess spawn. Includes negative-path cases: assert `assertSafeArg`/the namespace check
    reject certain inputs *before* the fixture binary is ever invoked (spy/mock confirms
    `execFile` not called for those cases). Runs automatically under CI's existing
    `npm test -- --run` (ci.yml) — no workflow YAML edit needed (confirmed: `ci.yml` line 42
    already runs the full suite).
  - Verify: `npm test -- cli-argv-smoke` (or whatever the file is named) green locally; confirm
    no `.github/workflows/*.yml` diff.
  - Files: new test file (e.g. `tests/cli-argv-smoke.test.ts`)

- [x] **T8: Docs + CLAUDE.md**
  - Acceptance: `docs/getting-started/installation.md`, `desktop-extension.md`,
    `diagnose-issues.md` examples are labeled by CLI generation (v1/v2), and none imply
    `--output json`/`himalaya folder list` is the only supported form. `CLAUDE.md` documents
    both supported himalaya CLI generations and how the branch is detected.
  - Verify: `grep -rn -- "--output json\|folder list" docs/ README.md` — every hit reviewed by
    hand, confirmed intentionally labeled, none stale/unlabeled.
  - Files: `docs/getting-started/installation.md`, `docs/getting-started/desktop-extension.md`,
    `docs/getting-started/diagnose-issues.md`, `CLAUDE.md`

## Phase D — final gate

- [x] **T9: Full verification pass — DONE via Docker-isolated `npm test`**
  - `npm run build` ✅ and `npm run build:bundle` ✅ both pass clean.
  - Per `feedback_no_vitest_direct.md` (memory), `npm test`/`vitest run` is never invoked
    directly on the host — Docker (`node:22`, bind-mounted worktree + a named volume for
    `node_modules`) was used instead so any leaked fork-pool workers die with the container
    rather than piling up on the host. Confirmed after each run: no stray `vitest`/`forks.js`
    processes on the host (`ps aux`), container removed (`--rm`).
  - First Docker run surfaced 48 failures, all `himalaya_version_undetected` — pre-existing
    fake-himalaya E2E fixtures (`v150-features.test.ts`, `e2e.test.ts`) didn't answer the new
    `--version` probe. Patched a version guard into each fixture; re-run dropped this to 25
    failures, a genuine gap: several pre-existing test files (`retry.test.ts`, `manage.test.ts`,
    `dogfood-reliability.test.ts`, parts of `client.test.ts`) mock `execFileAsync`/`spawn`
    directly and didn't account for `resolveVersion()`'s extra probe call. Fixed each by queuing
    a version response ahead of the real scenario (or spying `resolveVersion()` directly where
    exact call-count assertions mattered). Also found and fixed a real bug in the E2E fixture
    helper itself: `spawnHarnessWithFakeHimalaya` built its replacement as a template-literal
    string starting with `$1` (meant as a literal reference to the matched shebang), but passed
    it to `.replace()` as a *pattern string*, so the shell script's own `$1` positional parameter
    inside `versionGuard` collided with JS's `$1` capture-group backreference syntax and got
    silently corrupted into literal shebang text — switched to a function replacer. Also fixed
    a `fakeChildProcess()` race in the new `sendTemplate` spawn tests: it scheduled its
    `queueMicrotask` emit at construction time, which fired before `sendTemplate()`'s new
    `await resolveVersion()` let it reach `spawn()` and attach listeners — switched
    `mockSpawn.mockReturnValue(...)` to `mockImplementation(() => ...)` so construction (and
    the scheduled emit) happens only when `spawn()` is actually called.
  - Final run: **666/666 tests passed, 36/36 test files passed, exit 0** (`docker-test-run-3.log`).
  - Files: `tests/v150-features.test.ts`, `tests/e2e.test.ts`, `tests/retry.test.ts`,
    `tests/manage.test.ts`, `tests/dogfood-reliability.test.ts`, `tests/client.test.ts`
    (test-only changes, no `src/` changes needed for T9 itself).

## Follow-ups discovered during implementation (not in the original 9-task list)

- **`sendTemplate()` was a second, independently-broken call site.** It builds its own argv and
  calls `spawn()` directly — never goes through `execOnce()` — so its hardcoded `--output json`
  was NOT redundant with T4's fix as the original bug report assumed. Fixed alongside T4 (same
  dual-syntax branch). Had zero test coverage before this session (`compose.test.ts` mocks
  `sendTemplate` at the method level); added real `spawn()`-level tests in `client.test.ts`.
- **`checkEmailConnectivity()` in `doctor.ts` was a third independently-broken call site** —
  hardcodes `--output json`/`folder list` via its own `execQuiet` calls, entirely bypassing
  `HimalayaClient`/`cli-version.ts`. Fixed alongside T6 (not originally in the plan's file list).
  Also fixed two related JSON-shape bugs surfaced by the same code: v2's `account list --json`
  and `mailbox list --json` return `{accounts:[...]}`/`{mailboxes:[...]}` (wrapped), not the
  bare arrays the original parsing code assumed — would have silently degraded to a "could not
  parse" warning on v2 even after the flag fix.
- **Version-parsing regex bug caught by manual smoke-testing, not caught by the mocked unit
  tests**: `VERSION_RE` originally required a literal `v` prefix. A manual end-to-end run against
  the real compiled `dist/` + fixture (not vitest — a throwaway Node script) hit a real failure
  on the v1.x branch because the fixture's `"himalaya 1.1.0"` string has no `v` prefix, and real
  v1.x output was never independently verified (only v2.0.0 was live-tested against a real
  account). Fixed by making the `v` optional in the regex. This is a good argument for actually
  running `npm test` before merging — the mocked `cli-version.test.ts` unit test for this exact
  case would have failed too, but nothing forced it to run.
- **`sendTemplate()` has a pre-existing dangling `setTimeout` on success** (the timeout to kill a
  hung `spawn()` is never cleared when `close` fires first) — noticed while adding test coverage,
  NOT fixed (out of scope for this spec; flagging for a separate follow-up).
- **Real v1.x himalaya `--version` output format was never independently verified** (unlike
  v2.0.0, which was live-tested). The `"himalaya 1.1.0"` fixture string is a plausible guess, not
  confirmed. Low risk given the regex now tolerates both forms, but worth confirming if a v1.x
  install is ever available to test against.
