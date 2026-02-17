# Changelog

All notable changes to this project will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/).

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

- Default timeout changed from 30s to unlimited (0) for better large-mailbox support

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
