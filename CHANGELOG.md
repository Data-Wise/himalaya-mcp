# Changelog

All notable changes to this project will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/).

## [2.0.4] - 2026-08-05

### Fixed

- `himalaya-mcp doctor` now detects version drift in the Claude Code plugin chain: it compares the installed plugin's `plugin.json` version and the `local-plugins` marketplace source's version against the installed binary, and warns when the marketplace source is a directory copy instead of a symlink to the Homebrew install (so `brew upgrade` no longer propagates). `doctor --fix` auto-relinks stale directories to the Homebrew `libexec` layout.
- Raised the himalaya CLI version-probe timeout from 5s to 15s so slow or heavily loaded CI/Docker environments no longer false-fail CLI-version detection (`Could not detect himalaya CLI version`).
- `himalaya-mcp doctor`'s per-account health probe used hardcoded himalaya v1 CLI syntax (`folder list --output json`), which always failed on himalaya v2 (`unrecognized subcommand 'folder'`). It now detects the installed CLI's major version and uses `mailbox`/`--json` on v2.

### Changed

- Defaulted the vitest pool to `threads` so pool workers die with the vitest process — a harness timeout can no longer orphan fork-pool child processes holding memory. Full-suite verification now runs detached in Docker without `--rm` and uses `docker wait` to capture the real exit status.

## [2.0.3] - 2026-08-04

### Fixed

- `himalaya-mcp --version` printed `unknown` on Homebrew installs — `getVersion()` only looked for `package.json`, which the formula's `install` block never copies into `libexec/`. Falls back to `.claude-plugin/marketplace.json`'s `version` field.
- Removed a flaky test (a subprocess-spawning regression test that raced `tests/e2e.test.ts`'s `dist/` rebuild under vitest's default cross-file parallelism) in favor of a pure unit test with no shared-filesystem dependency; added `fileParallelism: false` to `vitest.config.ts` as defense in depth.

## [2.0.2] - 2026-08-04

### Fixed

- Support both himalaya CLI v1.x and v2.x — auto-detect the installed CLI's major version and branch every affected call site (`--output json` vs `--json`, `folder` vs `mailbox` subcommand) accordingly, so the same install works against either CLI generation.
- `create_folder`/`delete_folder` on himalaya v2 now shell out to `imap create`/`imap delete` directly (v2 dropped `folder create`/`delete` from the shared API), gated by a fail-closed IMAP-backend check and a namespace-hierarchy safety check on the folder name.
- Resolved 3 high/moderate-severity transitive dependency vulnerabilities (`fast-uri`, `hono`, `ip-address`) flagged by `npm audit`.

## [2.0.1] - 2026-08-02

### Fixed

- Derive the sender address from Himalaya `config.toml` when `HIMALAYA_FROM` is unset, including per-account `compose_email` overrides.
- Use Himalaya v2 account discovery syntax (`himalaya account list --json`) and accept the v2 `{ accounts: [...] }` response shape while preserving legacy array parsing.
- Surface himalaya stderr failures through structured error envelopes and preserve transient retry attempt counts.
- Wrap bare single-term `search_emails` queries as subject searches so natural queries like `invoice` work reliably.
- Harden `.mcpb` packaging by pinning the pack CLI and writing the final package filename directly to avoid CI file-visibility races.

### Changed

- Refreshed project documentation and agent instructions for the current 619-test inventory.

## [2.0.0] - 2026-07-23

### Changed (BREAKING)

- **Plugin renamed** from `email` to `himalaya` (issue #67). Install command: `claude plugin install himalaya`.
- **Skill commands** changed from `/email:*` to `/himalaya:*`.
- **Tool names** changed from `mcp__plugin_email_himalaya__*` to `mcp__plugin_himalaya_email__*`.
- **Hook matcher** changed from `mcp__plugin_email_himalaya` to `mcp__plugin_himalaya_email`.

### Added

- Migration guide: `docs/getting-started/migrate-plugin-name.md`.

### Fixed

- `doctor --pre-release` exec timeout is now configurable (was hardcoded 10s, too short for `tsc`/`vitest`); test-suite check no longer reports false failures via substring matching.

## [1.9.0] - 2026-07-07

### Added

- **7 new MCP tools:** `get_unread_count`, `read_email_raw`, `render_email`, `list_starred`, `create_reminder`, `snooze_email`, `list_snoozed_emails`.
- **1 new MCP prompt:** `weekly_email_digest` — weekly variant of the daily digest.
- **1 new plugin skill:** `/email:respond` — batch draft-reply workflow with per-draft approval.
- **`getTrashFolder()` utility** — provider-agnostic trash folder resolution (Gmail `[Gmail]/Trash`, Exchange `Deleted Items`, fallback `Trash`).
- **Apple Reminders adapter** — `create_reminder` adds tasks to Apple Reminders.app (macOS).
- **JSON-backed snooze persistence** — `snooze_email` / `list_snoozed_emails` with ISO and shorthand time formats (`tomorrow`, `monday`, `2h`, `1d`).
- **`create_action_item` extension** — new `destination` parameter for file capture.
- **`triage_inbox` enhancement** — added Priority (High/Medium/Low) and Category (Meeting/Task/Newsletter/Notification/Receipt/Travel/Social/Other) dimensions.
- **Migration documentation** — `docs/guide/migrating-from-em.md` command map and `docs/tutorials/migrating-from-em.md` walkthrough for flow-cli `em` users.
- **Count-sync test** — `TOOL_COUNT` constant and `tests/count-sync.test.ts` prevent silent drift between registered tools and docs.

### Changed

- **Tool count 22 → 29**, **prompt count 6 → 7**, **skill count 15 → 16** across all docs, plugin manifests, and help skill.
- **Docs site reorganized** — Tutorials grouped by task (Read & Browse / Respond & Organize / Compose & Automate), Guides split into Guides + Operations, Quick Reference merged into Cheat Sheet.
- **Desktop Extension and Diagnose Issues docs moved** from `docs/tutorials/` to `docs/getting-started/`.

### Fixed

- **Stale count references** — corrected outdated tool/prompt/skill/test counts across README, CLAUDE.md, docs, and test scripts.
- **Orphan doc pages** — removed duplicate `docs/tutorials/desktop-extension.md`, `docs/tutorials/diagnose-issues.md`, and merged `docs/reference/refcard.md` into Cheat Sheet.

## [1.8.1] - 2026-07-06

### Added

- **5 groff man pages:** `himalaya-mcp(1)`, `himalaya-mcp-doctor(1)`, `himalaya-mcp-setup(1)`, `himalaya-mcp-install-ext(1)`, `himalaya-mcp-remove-ext(1)`. Run `man himalaya-mcp` after install.
- **CLI modular refactor:** Split monolithic `setup.ts` (998 lines) into 5 focused modules: `index.ts` (dispatcher), `shared.ts` (utilities), `setup.ts` (check/remove), `doctor.ts` (diagnostics), `extension.ts` (install/remove .mcpb).

### Fixed

- **Homebrew bin script:** Forward arguments (`"$@"`) so `himalaya-mcp --help`, `--version`, `doctor` work correctly.
- **Homebrew man page install:** Use `Dir.glob` with explicit `libexec` base path for reliable installation.
- **`isMain` function:** Changed to accept caller's `import.meta.url` to work across CLI modules.
- **Version assertions:** Updated hardcoded "1.8.0" references in tests for consistency.

## [1.8.0] - 2026-07-06

### Added

- **3 new plugin skills:** `/email:forward` (forward with attribution), `/email:export` (markdown + clipboard + action items), `/email:threads` (conversation view). Total: 15 skills.
- **7 new workflows:** Forward & Redirect, Thread Conversation, Triage with Auto-Flag, Undo & Rollback, Search Syntax Reference, Integration Recipes (Obsidian, Reminders, SMS), Error Recovery. Total: 23 workflow patterns in workflows.md, 15 recipes in cookbook.md.
- **4 new automation workflows** in advanced-automation.md: Consolidated Task Extraction, Notification Routing, Smart Folder Rules, and restructured end-of-day reporting.
- **Cheat sheet** (`docs/reference/cheat-sheet.md`) — one-page quick reference with all CLI commands, MCP tools, prompts, resources, safety gates, and common workflows.
- **Security & Privacy deep-dive** (`docs/guide/security.md`) — auth flow, threat model, credential storage, safety gates, best practices.
- **Integrations guide** (`docs/guide/integrations.md`) — Obsidian, Apple Calendar/Reminders, other MCP servers, shell scripts.
- **Contributing guide** (`docs/guide/contributing.md`) — dev setup, test structure, build commands, documentation inventory.
- **CLI Reference** (`docs/reference/cli.md`) — dedicated page for `doctor`, `setup`, `install-ext`, `remove-ext`, `--help`, `--version`.

### Changed

- **CLI and MCP tools now documented separately** — `docs/reference/commands.md` is now MCP-only; `docs/reference/cli.md` covers CLI commands. Both referenced from index.md and nav.
- **Skill count 12 → 15** across all docs, plugin.json, refcard, and help skill.
- **Digest skill triggers disambiguated** — removed overlap with morning skill ("what happened overnight", "catch me up on email").
- **Help skill updated** — skills table expanded to 15 entries.
- **Docs reorganization:** stale specs removed (11 files), test counts fixed (484→507), Search & Manage tutorial created to fill Level 2 gap.
- **`package.json`** — added `engines: { node: ">=22" }`, `lint` script, `.nvmrc`, `dependabot.yml`.

### Fixed

- **UTC timezone loss in calendar events** — `formatICSDate` now preserves `Z` suffix, preventing events from being created at wrong local time.
- **Temp directory leaks** in `download_attachment` and `extract_calendar_event` — both now clean up temp dirs in `finally` blocks.
- **`listAccounts()` timeout** — now has 15s timeout to prevent hang during `doctor`/`health_check`.
- **Hardcoded `page_size: 50`** — bumped to 200 in `read_thread`, `export_to_markdown`, and `create_action_item` to reduce missed-message risk.
- **Inconsistent error format** in `read_email`/`read_email_html` — now uses structured `envelopeError()` like all other tools.
- **Weak email validation** in `compose_email` — `includes("@")` replaced with regex test.
- **Case-sensitive folder comparison** in client — `"INBOX"` vs `"inbox"` now handled via `.toUpperCase()`.
- **CI pipeline hardened:** `npm audit`, explicit `permissions: contents: read`, `concurrency` groups, pinned `mkdocs-material` version, scoped docs permissions, reusable workflow pinned to SHA, version input validation.

### Documentation

- Split CLI/MCP reference docs
- Added cheat sheet, security, integrations, contributing guides
- Added Search & Manage tutorial (Level 2)
- Added 7 new workflows (3 to workflows.md, 3 to cookbook.md, 1 search syntax reference)
- Added 4 advanced automation steps
- Removed 11 stale spec files
- Fixed stale test count references (484→507) across 3 files

## [1.8.0] - 2026-07-06

### Added

- **3 new plugin skills:** `/email:forward`, `/email:export`, `/email:threads` (15 total)
- **7 new workflows:** Forward & Redirect, Thread Conversation, Triage with Auto-Flag, Undo & Rollback, Search Syntax Reference, Integration Recipes, Error Recovery
- **4 new automation workflows** in advanced-automation.md
- **Cheat sheet** (`docs/reference/cheat-sheet.md`)
- **Security & Privacy deep-dive** (`docs/guide/security.md`)
- **Integrations guide** (`docs/guide/integrations.md`)
- **Contributing guide** (`docs/guide/contributing.md`)
- **CLI Reference** (`docs/reference/cli.md`)

### Changed

- CLI and MCP tools now documented separately
- Skill count 12 → 15 across all docs
- Digest skill triggers disambiguated from morning
- Docs reorganization: stale specs removed (11 files), test counts fixed (484→507), Search & Manage tutorial created

### Fixed

- UTC timezone loss in calendar events
- Temp directory leaks in download_attachment and extract_calendar_event
- listAccounts() timeout (added 15s timeout)
- Hardcoded page_size: 50 → 200 in thread and action lookups
- Weak email validation, case-sensitive folder comparison, many CI pipeline issues

## [1.7.0] - 2026-06-19

### Added

- **Attachment support for `compose_email` and `send_email`** — both tools now accept an `attachments` parameter (array of local file paths). Files are validated before send; missing paths return a structured error without sending. Attachments are formatted as MML (`<#part>` sections) and piped to `himalaya template send` via stdin. Supports all MIME types with auto-detection by extension.
- `src/tools/_attachments.ts` — shared attachment helper (`buildAttachmentMML`, `validateAttachments`) used by both compose and send tools.
- 23 new tests covering attachment preview, MML inclusion on send, missing-file error guard, and no-attachment baseline.

### Fixed

- **Flag injection guard** (community PR #53) — `HimalayaClient` now rejects flag-like argv values (strings starting with `-`) to prevent accidental option injection.
- **ICS escape sequences** (community PR #56) — RFC 5545 `\n`, `\,`, `\;`, `\\` sequences in calendar event fields are now unescaped correctly.
- **Zod explicit dependency** (community PR #54) — `zod` is now pinned as a direct dependency in `package.json` instead of relying on a transitive resolution.

### Changed

- Test count: 484 → 507 (23 new attachment tests across `compose.test.ts` and `compose-new.test.ts`).

## [1.6.2] - 2026-05-13

### Added

- **CLI `--help` / `-h` / `help`** — first-class help flag. Prints a versioned, grouped usage summary (Setup / Desktop extension / Diagnostics / Meta / Examples) to stdout and exits 0.
- **CLI `--version` / `-v` / `version`** — prints the semantic version on its own line and exits 0. Reads from `package.json` via the existing `getVersion()` helper.
- **"Diagnose Email Issues" tutorial** (`docs/tutorials/diagnose-issues.md`) — Level 1 walkthrough of the `health_check` tool, `himalaya-mcp doctor`, `--account` scoping, `--fix`, and the structured error-code table. Includes a mermaid decision-tree diagram mapping symptoms to commands.
- `--help` and `--version` discovery hints surfaced in `docs/reference/refcard.md`, `docs/getting-started/quickstart.md`, and `docs/getting-started/installation.md`.

### Changed

- CLI help header now includes the version (`himalaya-mcp CLI v1.6.2`).
- CLI help is reorganized into labeled sections (Setup, Desktop extension, Diagnostics, Meta, Examples) instead of a flat list.
- Help now explicitly documents the `check` and `remove` short aliases for `setup --check` / `setup --remove`.
- Test count: 479 → 484 (5 new CLI E2E tests covering `--help`, `-h`, `help`, `--version`, `-v`, and unknown-command exit behavior).
- Learning path total time: 43 min → 48 min (added diagnostics tutorial).

### Fixed

- Unknown CLI commands now write a short hint to stderr and exit with code 1, instead of dumping full help to stdout and exiting 0. Lets scripts detect typos. The full help only ever goes to stdout via `--help`.

## [1.6.1] - 2026-05-12

### Added

- **Round-trip envelope E2E tests** (`tests/e2e.test.ts`) — five tests spawn `dist/index.js` with a fake himalaya and assert the full structured-error pipeline (client → tool → MCP stdio → JSON-RPC response). Covers `imap_auth_failed`, `transient` (with `attempts=2` after retry), `folder_not_found`, `parse_error`, and the `health_check` tool. Replaces the skipped Scenario 17 in `dogfood-reliability.test.ts`.
- **Homebrew workflow auth pre-check** — new `verify-tap-auth` job in `homebrew-release.yml` validates that GitHub App credentials OR a working PAT are present before invoking the tap update. Surfaces a clear runbook when both are missing or the PAT is expired, instead of letting `actions/checkout` die with "fatal: could not read Username". Targets the recurring v1.5.0 / v1.6.0 release auth failure.

### Changed

- Test count: 473 passing / 1 skipped → 479 passing / 0 skipped. Scenario 17 in `dogfood-reliability.test.ts` is now a passing sentinel pointing to the new e2e tests.
- Documentation sync across 16 files: test count claims, tool count claims (21 → 22), and bundle size claims (595KB → 604KB, .mcpb 147KB → 151KB) now reflect the live build.

### Fixed

- **Homebrew CI auth (v1.5.0 + v1.6.0 release regression)** — set `APP_ID` and `APP_PRIVATE_KEY` secrets on this repo so the reusable workflow's GitHub App token path activates. Verified end-to-end via `workflow_dispatch` against v1.6.0 (tap PR #106 merged, manifest drift corrected from v1.4.1 → v1.6.0). Next release no longer needs the manual formula bump.

## [1.6.0] - 2026-05-11

### Added

- `health_check` MCP tool — exposes multi-account diagnostics during conversations. Returns `overall` status (`healthy`/`degraded`/`broken`) plus per-account detail with code, hint, and retry attempts from the structured error envelope.
- `himalaya-mcp doctor --account <name>` flag for targeted diagnostics. Doctor now iterates all configured accounts by default.
- `docs/troubleshooting.md` — user-facing guide for the five most common email failure modes with error-code reference table.
- `src/himalaya/errors.ts` — structured `MCPError` envelope (`code`, `message`, `hint`, `account`, `recoverable`, `attempts`, `rawStderr`) and `HimalayaError` class. Stderr-pattern classifier covers 10 known codes plus `unknown` fallthrough.
- `src/himalaya/accounts.ts` — multi-account discovery via `himalaya account list -o json`.
- `parse_error` MCP error code for parser failures (envelope JSON decode), so the MCP response shape is invariant across subprocess and parser failure modes.

### Changed

- `himalaya-mcp doctor` now reports per-account health (table view) instead of testing only the default account.
- All tool handlers surface structured error envelopes via the shared `envelopeError` helper — including parser failures in `list_emails`, `search_emails`, `list_threads`, and `read_thread`, which previously returned a plain `"Error: ..."` string.
- `doctor --json` output now includes a per-account `Accounts` category section, mirroring the text output.
- `health_check` probes accounts in parallel (`Promise.all`) — N-account latency is bounded by the slowest probe, not the sum.
- `accounts.ts listAccounts()` throws `HimalayaError` (with codes `himalaya_not_installed` and `parse_error`) instead of plain `Error` — consistent with the rest of the client surface.
- Auth-failure regex broadened to also match "login failed/error/rejected" and "auth rejected" stderr variants.
- Tool count: 21 → 22.

### Fixed

- Transient IMAP failures (`ECONNRESET`, `ETIMEDOUT`, `* BYE`) auto-retry once with 200ms backoff before surfacing as errors. Configurable via `retryBackoffMs` option.
- `HimalayaClient.exec` retry loop now throws a defensive `Error` if the loop somehow exits without returning or throwing, instead of a possibly-`undefined` reference.
- `v150-features.test.ts` morning/inbox `beforeAll` hook timeout bumped 60s → 120s to absorb CI cold-start variance.

### Security

- `MCPError.rawStderr` preserves the verbatim stderr from himalaya. Callers should treat the field as untrusted input and not surface it to end-users without sanitization. The MCP protocol model expects Claude to summarize structured errors to the user — `rawStderr` is for debugging, not display.

## [1.5.0] - 2026-03-17

### Added

- **Thread/conversation view** — `list_threads` groups emails by subject into conversations; `read_thread` shows all messages in a thread chronologically (21 tools total)
- **Morning briefing prompt** — `morning_briefing` MCP prompt guides urgency classification, calendar event extraction, and action item identification
- **Inbox check prompt** — `inbox_check` MCP prompt for quick status with unread count, highlights, and suggested next actions (6 prompts total)
- **`/email:morning` skill** — Morning email briefing with urgency classification and follow-up actions (12 skills total)
- **SessionStart hook** — Injects email context at conversation start so "check my email" works without explicit `/email:inbox`
- **Broadened skill descriptions** — All 12 skills now trigger from natural language variants (e.g., "any new messages", "what needs attention", "catch me up on email")
- Thread parser with `normalizeSubject` (strips Re:/Fwd:/RE:/FW: prefixes) and `groupIntoThreads` (subject-line grouping with chronological sorting)
- 72 new tests (thread parser, tool registration, prompt tests, v1.5.0 E2E) — 414 total

## [1.4.1] - 2026-03-03

### Fixed

- Convert skills from flat `.md` files to `SKILL.md` subdirectory format (11 skills now load correctly in Claude Code)
- Remove `email:` prefix from skill `name` fields (Claude Code auto-prefixes plugin namespace)

### Added

- Enhanced skill descriptions for better auto-invocation matching (uses "This skill should be used when..." pattern)
- Plugin cache freshness check in `doctor` / `doctor --fix` (detects and removes stale cache directories)

## [1.4.0] - 2026-02-26

### Added

- **`/email:search` skill** — Search emails by keyword, sender, flags, or date with himalaya filter syntax
- **`/email:manage` skill** — Bulk email operations (flag, unflag, move, archive) with confirmation gate for >5 emails
- **`/email:stats` skill** — Inbox statistics: unread count, top senders, oldest unread, optional weekly trends
- **`/email:config` skill** — Interactive setup wizard with provider templates (Gmail, Outlook, Fastmail), connection testing, and `--check` validation mode
- **Pre-send confirmation hook** — PreToolUse hook showing email preview (To, Subject, body snippet) before send/compose operations; logs to `~/.himalaya-mcp/sent.log`
- **Cookbook** — Common email workflow patterns and recipes (`docs/guide/cookbook.md`)

### Changed

- Plugin description updated to reflect 11 skills + 1 hook
- `/email:help` hub updated with new skills, hooks section, and quick reference entries
- `plugin.json` now includes `hooks` registration for PreToolUse

### Fixed

- Pre-send hook tests rewritten with HOME isolation (no audit log pollution)
- Cross-platform CI fix: use `fs.statSync().mode` instead of macOS-only `stat -f %Lp`
- Removed dead `execFileSync` try/catch in hook tests (was running hook twice)

## [1.3.1] - 2026-02-25

### Fixed

- CI glob safety and timeout default handling
- `doctor` test handles non-zero exit codes in CI environments
- Consistent plugin install command (`claude plugin install email`) across all docs

### Documentation

- **Quickstart**: Tabbed multi-method install (Homebrew, GitHub Marketplace, Source) with `pymdownx.tabbed`
- **Installation**: Prerequisites section, verification steps with `himalaya-mcp doctor` after each method
- **README**: Verification blocks and prerequisites for all install methods
- **Troubleshooting**: 3 new sections — skills nesting bug, MCP tools not available, plugin not found
- **Packaging**: Distribution architecture diagram (Mermaid), updated libexec layout paths
- **Reference**: Updated refcard with doctor verification, desktop-extension with .mcpb prerequisite admonition

## [1.3.0] - 2026-02-17

### Added

- `.mcpb` Desktop Extension packaging for Claude Desktop/Cowork (manifest, build script, CI workflows)
- `install-ext` / `remove-ext` CLI commands for local extension management
- `doctor` diagnostic command with `--fix` and `--json` flags (checks 6 layers: prereqs, MCP server, email, Desktop extension, Code plugin, env)
- Desktop Extension tutorial, troubleshooting guide, and `.mcpb` format reference docs
- 39 new tests (314 total): .mcpb packaging validation, doctor E2E, config template guards

### Fixed

- himalaya v1.1.0 argument ordering (`--account`/`--output` flags now placed after subcommand)
- Unresolved `${user_config.*}` template variables from Desktop Extension config (config loader ignores `${` prefixed values)
- PATH environment variable included in `.mcpb` manifest for Claude Desktop compatibility

### Changed

- Default timeout changed from 30s to 120s (was briefly set to unlimited in v1.3.0; now 2 min for safety, set `HIMALAYA_TIMEOUT=0` for unlimited)

### Documentation

- **Quickstart**: Tabbed multi-method install (Homebrew, GitHub Marketplace, Source)
- **Installation**: Prerequisites, verification steps, `himalaya-mcp doctor` after each method
- **README**: Verification blocks and prerequisites for all install methods
- **Troubleshooting**: New sections for skills nesting, MCP tools missing, symlink verification
- **Packaging**: Distribution architecture diagram (Mermaid), updated libexec layout
- **Reference**: Updated refcard with doctor verification

## [1.2.2] - 2026-02-16

### Fixed

- Setup CLI resolves MCP server path dynamically instead of hardcoding (works across install methods)

### Added

- Install/upgrade E2E tests and CLI test suites (275 total tests across 15 files)

## [1.2.1] - 2026-02-16

### Changed

- **Plugin namespace renamed** from `himalaya-mcp` to `email` — skills are now `/email:inbox`, `/email:triage`, etc. (5-char prefix instead of 13)
- Updated all documentation, tests, and marketplace manifest to reflect new namespace
- MCP server name, npm package, Homebrew formula, and GitHub repo remain `himalaya-mcp`

## [1.2.0] - 2026-02-15

### Added

- **Folder management** (3 tools): `list_folders`, `create_folder`, `delete_folder` (with safety gate)
- **Compose new emails**: `compose_email` tool with two-phase safety gate (preview then confirm)
- **Attachments** (2 tools): `list_attachments` (with body part filtering and MIME inference), `download_attachment`
- **Calendar integration** (2 tools): `extract_calendar_event` (ICS parser), `create_calendar_event` (Apple Calendar via AppleScript, with safety gate)
- Plugin skills: `/email:compose` (new email composition), `/email:attachments` (list, download, calendar invites)
- 91 dogfood tests covering v1.2.0 tools (folders, compose, attachments, calendar)
- 32 E2E tests (up from 22) — fake himalaya binary now creates real files on disk for attachment pipeline testing
- 256 total tests across 15 test files

### Documentation

- Full command reference for all 8 new tools with parameters, examples, and safety flows
- New tutorials: Compose & Send Email, Attachments & Calendar
- Updated workflows: compose, attachment download, calendar invite, folder management patterns
- Updated refcard, guide, and help skill with all 19 tools
- CHANGELOG v1.2.0 entry

## [1.1.1] - 2026-02-14

### Added

- Automated Homebrew formula update workflow (`homebrew-release.yml`)
  - Triggers on GitHub release publish or manual `workflow_dispatch`
  - 3-stage pipeline: validate (build/test/bundle + version check) → prepare (tarball SHA256 with retry) → update-homebrew (reusable workflow)
  - Injection-safe: all GitHub context expressions use `env:` indirection

### Fixed

- Hardened homebrew-release tarball download: `mktemp` for temp files, `--max-time 30` on curl, `sha256sum` (native on Ubuntu runners)
- Setup E2E tests skip gracefully when `dist/` not built (`describe.skipIf`)
- Setup E2E tests actually run when build exists: use `accessSync` (unmocked) instead of `existsSync` (mocked by `vi.mock`), fixing `vi.mock` interference that silently skipped 4 tests
- marketplace.json source path `"./"` back to canonical `"."` (fixes dogfood test)
- Homebrew post-install script hangs when Claude Code is running: guard all JSON file writes (`marketplace.json`, `settings.json`) behind `pgrep` check, replaced slow `lsof` with `pgrep -x "claude"`
- Homebrew reusable workflow cross-repo push auth: `persist-credentials: false` + `unset GITHUB_TOKEN` to prevent runner credential helper override
- Removed stale `lint` script referencing uninstalled eslint

### Documentation

- Added Claude Desktop section to user guide: platform comparison table, setup command details, config file paths, usage examples
- Split tutorials into 6 individual pages with learning path diagram (#15)
  - Level 1: Read First Email, Multi-Account
  - Level 2: Triage Inbox, Reply to Email, Export & Save
  - Level 3: Automate with Agent
  - Mermaid flowchart showing progression between levels
- Added tutorials cross-references to index, installation, quickstart, and commands pages
- Added test breakdown table to README (unit/integration/dogfood/E2E)
- Added "See also" cross-links in command reference to tutorials and workflows

## [1.1.0] - 2026-02-14

### Added

- Plugin packaging for Homebrew distribution (#10)
  - esbuild bundle (583KB single-file, eliminates 72MB node_modules)
  - `himalaya-mcp setup` CLI for Claude Desktop config (macOS/Linux/Windows)
  - Homebrew formula with auto-symlink and marketplace registration
  - `brew install data-wise/tap/himalaya-mcp` zero-config install
- GitHub marketplace install: `claude plugin marketplace add Data-Wise/himalaya-mcp`
- 18 setup CLI tests (unit + E2E with subprocess)

### Fixed

- plugin.json schema cleaned for Claude Code strict validation

### Documentation

- Tutorials, skills guide, troubleshooting pages (#7)
- Packaging guide with esbuild bundle and Homebrew formula details
- CLI setup command reference with cross-platform config paths
- Git workflow and branch protection rules
- Full README rewrite with all install paths and GitHub Pages links
- Updated install commands across all docs (refcard, architecture, index)

## [1.0.0] - 2026-02-13

### Added

- 11 MCP tools: list_emails, search_emails, read_email, read_email_html, flag_email, move_email, draft_reply, send_email, export_to_markdown, create_action_item, copy_to_clipboard
- 4 MCP prompts: triage_inbox, summarize_email, daily_email_digest, draft_reply
- 3 MCP resources: email://inbox, email://message/{id}, email://folders
- 5 plugin skills: /email:inbox, /email:triage, /email:digest, /email:reply, /email:help
- Email assistant agent
- Two-phase send safety gate (preview then confirm)
- Multi-account support via `account` parameter
- Env-based configuration (HIMALAYA_BINARY, HIMALAYA_ACCOUNT, HIMALAYA_FOLDER, HIMALAYA_TIMEOUT)
- copy_to_clipboard adapter (pbcopy/xclip)
- GitHub Pages documentation site
- 142 tests across 10 test files (unit, dogfooding, E2E)
