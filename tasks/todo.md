# Tasks: himalaya CLI v1.x/v2.x Dual Compatibility Fix

Plan: [tasks/plan.md](plan.md) · Spec: [docs/specs/SPEC-himalaya-v2-cli-compat-2026-08-03.md](../docs/specs/SPEC-himalaya-v2-cli-compat-2026-08-03.md)

Execute on a `feature/*` worktree branched from `dev` (per spec assumption #1 — this is code).

## Phase A — foundations (parallelizable, no interdependencies)

- [ ] **T1: `cli-version.ts` — version detection module**
  - Acceptance: exports `detectHimalayaVersion()`; regex-extracts leading `v(\d+)` major from
    `himalaya --version` stdout; own 5s timeout independent of command timeout; on
    timeout/empty/unparseable output, throws/returns a distinct, named failure (not silently
    defaulting to v1 or v2, not a generic "unknown" error); no module-level cache (per spec
    Resolved Decision #3).
  - Verify: `npm test -- cli-version` — covers a real v2.0.0 string, a plausible v1.x string, a
    dev/git-rev build with no `v` prefix, empty stdout, and a deliberately slow-responding fake
    process to prove the 5s timeout actually fires.
  - Files: `src/himalaya/cli-version.ts`, `tests/cli-version.test.ts`

- [ ] **T2: `errors.ts` — `unsupported_backend` error code**
  - Acceptance: `MCPErrorCode` union gains `"unsupported_backend"`; a helper/constructor to
    raise it client-side (pre-flight, not via `classifyStderr`); confirm its use never risks
    matching the existing `transient` pattern's regex (per LOW finding).
  - Verify: `npm test -- errors` — existing tests unchanged/still green, new test for the added
    code's shape and `recoverable: false`.
  - Files: `src/himalaya/errors.ts`, `tests/errors.test.ts`

- [ ] **T3: `accounts.ts` — expose `backends`, add `isImapAccount()`**
  - Acceptance: `Account` type gains `backends?: string[]`; `listAccounts()` populates it from
    the raw JSON's `backend`/`backends` fields (singular v1-style or plural v2-style); new
    `isImapAccount(account)` returns `false` (fail-closed) when `backends` is missing, empty, or
    contains no recognized IMAP value — never defaults to `true`.
  - Verify: `npm test -- accounts` — explicit cases for present/absent/empty/malformed
    `backends`, both singular and plural raw-JSON shapes.
  - Files: `src/himalaya/accounts.ts`, `tests/accounts.test.ts`

- [ ] **T7a: CI argv fixture — content only (no wiring yet)**
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

- [ ] **T4: `client.ts` — dual-syntax `execOnce()`/`listFolders()`** *(needs T1)*
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

- [ ] **T5: `client.ts` — `createFolder()`/`deleteFolder()` dual-path + namespace safety**
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

- [ ] **T6: `doctor.ts` — version/branch reporting** *(needs T1)*
  - Acceptance: `checkPrerequisites()` calls `detectHimalayaVersion()` once per doctor run
    (not once per check), reports the major version and which syntax branch (v1/v2) is active
    as `pass` for any parseable version, `fail` only when the version string is genuinely
    unparseable/unrecognized (not a deprecation warning for v1.x).
  - Verify: doctor-specific test file green; manual `node dist/cli/index.js doctor` run against
    the real installed `himalaya 2.0.0`, confirm output names the v2/mailbox branch.
  - Files: `src/cli/doctor.ts`, doctor's test file (confirm exact filename when starting this task)

## Phase C — integration + docs

- [ ] **T7b: Wire the CI fixture into a real test file** *(needs T4, T5)*
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

- [ ] **T8: Docs + CLAUDE.md**
  - Acceptance: `docs/getting-started/installation.md`, `desktop-extension.md`,
    `diagnose-issues.md` examples are labeled by CLI generation (v1/v2), and none imply
    `--output json`/`himalaya folder list` is the only supported form. `CLAUDE.md` documents
    both supported himalaya CLI generations and how the branch is detected.
  - Verify: `grep -rn -- "--output json\|folder list" docs/ README.md` — every hit reviewed by
    hand, confirmed intentionally labeled, none stale/unlabeled.
  - Files: `docs/getting-started/installation.md`, `docs/getting-started/desktop-extension.md`,
    `docs/getting-started/diagnose-issues.md`, `CLAUDE.md`

## Phase D — final gate

- [ ] **T9: Full verification pass**
  - Acceptance: all 10 success criteria in the spec satisfied.
  - Verify: `npm test` (full suite, exact pass count recorded — per `pre-pr-testing.md`, this is
    a code change requiring the full-suite tier, run in the worktree's own path); `npm run
    build`; `npm run build:bundle`; optional one-time `HIMALAYA_MCP_LIVE_TEST=1` manual run.
  - Files: none (verification only)
