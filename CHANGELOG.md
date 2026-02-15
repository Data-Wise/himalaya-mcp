# Changelog

All notable changes to this project will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/).

## [1.1.2] - 2026-02-15

### Fixed

- Homebrew install script uses `ln -sfh` to prevent circular `libexec/libexec` symlinks on reinstall
- Homebrew install script uses full paths (`/bin/ln`, `/bin/mkdir`, `/bin/rm`) and `HOMEBREW_PREFIX` env var for restricted PATH contexts
- Removed Homebrew `post_install` symlink attempt: macOS `sandbox-exec` blocks writes outside Homebrew-managed paths; users run `himalaya-mcp-install` manually
- Homebrew install script migrates plugin scope from `himalaya-mcp-marketplace` to `local-plugins` and cleans stale cache
- Removed unreliable `claude plugin update` from Homebrew `post_install`
- Unblocked 4 skipped setup E2E tests (`vi.mock` interference with `existsSync`)
- Removed stale `lint` script referencing uninstalled eslint

### Added

- Automated Homebrew formula update workflow (`homebrew-release.yml`) with 3-stage pipeline
- Bundle, plugin validation, and lint checks in CI workflow

### Documentation

- Added Claude Desktop section to user guide with platform comparison table
- Updated test counts across site and project files (160 → 181)
- Synced changelog with all Homebrew fixes and sandbox limitation discovery

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
- Homebrew install script scope mismatch: migrates `himalaya-mcp@himalaya-mcp-marketplace` → `himalaya-mcp@local-plugins` in settings.json, cleans up stale marketplace cache
- Removed unreliable `claude plugin update` from Homebrew `post_install` (fails due to nested session detection); install script handles settings.json directly via jq
- Homebrew install script uses `ln -sfh` to prevent circular `libexec/libexec` symlinks on reinstall
- Homebrew install script uses full paths (`/bin/ln`, `/bin/mkdir`, `/bin/rm`) and `HOMEBREW_PREFIX` env var for restricted PATH contexts
- Removed Homebrew `post_install` symlink attempt: macOS `sandbox-exec` blocks all writes outside Homebrew-managed paths; users run `himalaya-mcp-install` manually instead

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
