# BUG: himalaya-mcp is 100% non-functional against himalaya CLI v2.0.0

**Filed:** 2026-08-03
**Severity:** Critical — every MCP tool call fails, on the CLI version Homebrew ships today
**Status:** Confirmed with reproducible evidence (see below). No code changed this session.

## TL;DR for maintainers

This is **not** a local config or IMAP issue, and there is **no CLI update to chase** —
`himalaya 2.0.0` is already the current `brew install himalaya` stable release. The bug is
100% in `himalaya-mcp`: `src/himalaya/client.ts`'s `execOnce()` unconditionally appends
`--output json` to every subprocess call (line 153), and that flag was removed in himalaya's
v2.x CLI rewrite. Every single exec() call — list, search, read, flag, move, folders, accounts,
compose, everything — currently errors out before reaching IMAP.

## Reproducible evidence

Installed CLI:

```text
$ himalaya --version
himalaya v2.0.0 +gmail +jmap +msgraph +smtp +rustls-ring +imap +m2dir
```

Homebrew confirms this is the current stable, not a beta/HEAD install:

```text
$ brew info himalaya
==> himalaya: stable 2.0.0 (bottled)
```

### 1. `--output json` is gone — breaks every exec() call

```text
$ himalaya envelope list --output json
error: unexpected argument '--output' found
Usage: himalaya envelope list [OPTIONS]
```

### 2. The IMAP connection itself is fine — proven with the correct flag

```text
$ himalaya envelope list --json
{"envelopes":[{"id":"260188","message-id":"...","subject":"Try all 4 snacks...","from":[{"...
```

Real UNM inbox data comes back immediately. Nothing wrong with the account, network, or
credentials — this rules out `HIMALAYA_ACCOUNT`/`HIMALAYA_BINARY`/config drift as the cause.

### 3. `folder` subcommand doesn't exist in v2 — it's `mailbox`

```text
$ himalaya folder list
error: unrecognized subcommand 'folder'

$ himalaya mailbox list --json
{"mailboxes":[{"id":"admin","name":"admin",...},{"id":"Inbox",...}, ...]}   # works
```

### 4. `mailbox create` / `mailbox delete` don't exist anywhere in the shared API

```text
$ himalaya mailbox --help
Commands:
  list  Shared API to list mailboxes for the active account [alias: ls]
  help  ...
```

No `create`, no `delete`. The only place CREATE/DELETE mailbox verbs still exist is the
**protocol-specific** `imap` subtree:

```text
$ himalaya imap --help
Commands:
  ...
  create   Create the given mailbox (CREATE, RFC 3501)
  delete   Delete the given mailbox (DELETE, RFC 3501)
  ...
```

That's IMAP-only — it has no JMAP/Gmail/msgraph equivalent, so it can't be a drop-in swap for
`mailbox create`/`mailbox delete` the way `folder list` → `mailbox list` is. This needs a real
design decision, not a rename.

## Exact broken lines

`src/himalaya/client.ts`:

| Line | Current | Fix |
|---|---|---|
| 153 | `args.push("--output", "json");` (in `execOnce`, unconditional, hits **every** call) | `args.push("--json");` |
| 322 | `const args = ["template", "send", "--output", "json"];` (redundant — `execOnce` already appends the flag) | drop the literal, or drop the duplication once 153 is fixed |
| 363 | `return this.exec(["folder", "list"], { account });` | `["mailbox", "list"]` |
| 369 | `return this.exec(["folder", "create", name], { account });` | **no direct replacement** — see below |
| 377 | `return this.exec(["folder", "delete", "--yes", name], { account });` | **no direct replacement** — see below |

Docs with the same stale syntax (not exhaustive — grep the whole tree before fixing):
`docs/getting-started/installation.md:18`, `docs/getting-started/desktop-extension.md:24`,
`docs/getting-started/diagnose-issues.md:86` (`himalaya folder list`).

## Why `create_folder`/`delete_folder` need real work, not a find-replace

- `mailbox create`/`mailbox delete` were removed from the shared (backend-agnostic) API in
  himalaya v2.
- The only surviving create/delete verbs live under `himalaya imap create|delete <name>` —
  IMAP-specific, RFC 3501 semantics.
- himalaya-mcp is explicitly multi-backend (imap/jmap/gmail/msgraph per `account.ts`). Wiring
  `create_folder`/`delete_folder` straight to `imap create`/`imap delete` would silently break
  (or need an explicit unsupported-backend error) for any Gmail/JMAP/msgraph account.
- Options to evaluate: (a) shell to `imap create`/`imap delete` and detect+error cleanly on
  non-IMAP backends, (b) mark the two tools IMAP-only in their tool descriptions/error envelope,
  (c) wait and see if a shared-API mailbox create/delete lands in a later himalaya release and
  gate on CLI version. This needs a decision, not just a mechanical patch.

## Brainstorm

### Quick Wins (< 30 min)
1. **Fix `execOnce()` line 153**: `--output json` → `--json`. This alone unblocks every read
   path (list/search/read/flag/move/accounts) — the highest-leverage single-line fix in the repo.
2. **Fix `listFolders()` line 363**: `["folder","list"]` → `["mailbox","list"]`.
3. Drop the now-redundant literal `--output json` in `template send` (line 322) once execOnce
   is fixed, to avoid it becoming a second copy of the same bug next time the CLI changes.

### Medium Effort (1-2 hrs)
- [ ] Grep the whole repo (`src/`, `docs/`, `tests/`) for `--output json` and `folder ` (subcommand
  position) — this session only checked `client.ts`; other tools/tests may embed the same
  literal strings in mocks or doc examples.
- [ ] Decide and implement the `create_folder`/`delete_folder` fix from the three options above.
- [ ] Add a real (non-mocked) smoke test — e.g. an opt-in E2E gated behind an env var that runs
  `himalaya mailbox list --json` against a live/test account — because the existing 619 tests
  all mock `execFileAsync` and none of them caught this: they assert on the args *this repo*
  builds, not on whether the real CLI still accepts them.

### Long-term (future sessions)
- [ ] **CLI version detection/compat matrix.** himalaya has now made two breaking CLI syntax
  changes in this project's lifetime (v1.1.0 arg-ordering, v1.2.0 dropped `--html`, v2.x renamed
  `folder`→`mailbox`, dropped `--output`, dropped mailbox create/delete from the shared API).
  Detecting `himalaya --version` at startup (or in `doctor`) and warning on an unsupported major
  version would turn "every tool call silently 400s" into a clear, actionable diagnostic instead
  of a debugging session per user.
- [ ] Pin/document the actually-supported himalaya CLI version range in README and `doctor`
  output, so a `brew upgrade himalaya` that jumps a major version is caught before it strands
  users on a totally broken MCP server.

## Recommended Next Step
→ Start with **Quick Win #1** (the `--output json` → `--json` fix in `execOnce()`) — it is the
single line gating literally every tool in this server, and it's the one already confirmed
correct against the real, currently-shipping himalaya CLI.

## What NOT to tell users
Do not send anyone chasing a himalaya CLI update — 2.0.0 **is** current stable. Telling a user to
"upgrade himalaya" when they report broken email tools will send them in a circle: they're
already on the CLI version that broke this integration.

---

## Resolved — 2026-08-17

Fixed across v2.0.2 → v2.1.0 and verified against the installed CLI. No v1 call sites remain in
`src/`, and — the check that actually mattered, since this bug was filed against the built bundle —
none in the installed `libexec` artifact either. Issues #114, #101, and #109 (three filings of this
same root cause) were closed 2026-08-16 on that evidence.

The user-facing guidance above still holds: do not tell anyone to upgrade the himalaya CLI to fix
broken email tools.

See `.STATUS` for current state and
[`SPEC-himalaya-v2-cli-compat-2026-08-03.md`](SPEC-himalaya-v2-cli-compat-2026-08-03.md) for the
design that resolved it.
