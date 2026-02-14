# SPEC: Plugin Packaging & Distribution

**Status:** draft
**Created:** 2026-02-14
**From Brainstorm:** BRAINSTORM-proper-plugin-packaging-2026-02-14.md
**Primary User:** Developer (personal distribution)

---

## Overview

Package himalaya-mcp as a proper Claude Code plugin distributed via Homebrew (`brew install data-wise/tap/himalaya-mcp`). The formula declares `depends_on "himalaya"`, bundles a single-file esbuild output (no `node_modules`), auto-symlinks to `~/.claude/plugins/`, and registers in the local marketplace. Zero-config: install and it works.

---

## Primary User Story

**As a** developer who uses Claude Code across machines,
**I want to** run `brew install data-wise/tap/himalaya-mcp` and have email tools immediately available,
**So that** I don't need to manually symlink, configure MCP servers, or manage dependencies.

### Acceptance Criteria

- [ ] `brew install data-wise/tap/himalaya-mcp` completes successfully
- [ ] himalaya CLI is installed as a dependency
- [ ] Plugin auto-symlinks to `~/.claude/plugins/himalaya-mcp`
- [ ] Plugin registers in `~/.claude/local-marketplace/marketplace.json`
- [ ] Plugin auto-enables in `~/.claude/settings.json`
- [ ] MCP server starts correctly via `${CLAUDE_PLUGIN_ROOT}/dist/index.js`
- [ ] `/email:inbox`, `/email:triage`, `/email:digest`, `/email:reply` skills load
- [ ] `brew uninstall himalaya-mcp` cleans up symlinks and marketplace entry
- [ ] `brew upgrade himalaya-mcp` preserves user configuration

---

## Secondary User Stories

### Community Developer

**As a** developer who discovers himalaya-mcp,
**I want to** install it from the official Anthropic plugin directory or GitHub,
**So that** I can get email tools without Homebrew.

**Acceptance:** `claude plugin add github:Data-Wise/himalaya-mcp` works.

### Claude Desktop User

**As a** Claude Desktop user,
**I want to** run `himalaya-mcp setup` after installing,
**So that** the MCP server is auto-configured in `claude_desktop_config.json`.

**Acceptance:** Setup command adds server entry without breaking existing config.

---

## Architecture

```
Distribution Channels
=====================

Homebrew (Primary)                  GitHub (Fallback)
  brew install himalaya-mcp           claude plugin add github:Data-Wise/himalaya-mcp
  │                                   │
  ├─ depends_on "himalaya"            └─ Copies plugin to cache
  ├─ depends_on "node"                   Uses ${CLAUDE_PLUGIN_ROOT}
  │
  ├─ libexec/
  │   ├─ .claude-plugin/plugin.json
  │   ├─ .mcp.json
  │   ├─ plugin/skills/*.md
  │   ├─ plugin/agents/*.md
  │   └─ dist/index.js (esbuild bundle, ~300KB)
  │
  └─ post_install → himalaya-mcp-install
      ├─ symlink → ~/.claude/plugins/himalaya-mcp
      ├─ register → ~/.claude/local-marketplace/marketplace.json
      └─ auto-enable → ~/.claude/settings.json

Runtime
=======

Claude Code loads plugin
  → Reads .mcp.json
  → Spawns: node ${CLAUDE_PLUGIN_ROOT}/dist/index.js
  → MCP server starts
  → himalaya CLI found via PATH (/opt/homebrew/bin/himalaya)
  → 11 tools, 4 prompts, 3 resources available
```

---

## Technical Requirements

### Phase 1: esbuild Bundle (eliminates node_modules)

**Problem:** `node_modules` is 72MB for one production dep (`@modelcontextprotocol/sdk`). The compiled `dist/` is 276KB.

**Solution:** Use esbuild to bundle everything into a single `dist/index.js`:

```bash
npx esbuild src/index.ts --bundle --platform=node --target=node22 --outfile=dist/index.js --format=esm --external:none
```

**Files to modify:**
- `package.json` — Add `"build:bundle"` script using esbuild
- `tsconfig.json` — May need `"module": "ESNext"` adjustments
- `.mcp.json` — No change (already points to `dist/index.js`)

**Verification:**
- Bundle runs standalone: `node dist/index.js`
- All 122 tests still pass
- No runtime `require()` of external packages

### Phase 2: Homebrew Formula

**File:** `~/projects/dev-tools/homebrew-tap/Formula/himalaya-mcp.rb`

**Pattern:** Follow `craft.rb` exactly (proven approach):

| Step | What | How |
|------|------|-----|
| `depends_on` | himalaya + node | `depends_on "himalaya"` + `depends_on "node"` |
| `install` | Build + copy to libexec | `npm run build:bundle` then `libexec.install` |
| `bin` scripts | install + uninstall | `himalaya-mcp-install`, `himalaya-mcp-uninstall` |
| `post_install` | Auto-setup | Runs `himalaya-mcp-install` |
| `caveats` | Usage instructions | Skills list + Claude Desktop config |
| `test` | Verify structure | Check plugin.json, dist/index.js exist |

**Install script responsibilities** (same as craft-install):
1. Symlink `libexec` → `~/.claude/plugins/himalaya-mcp`
2. Register in `~/.claude/local-marketplace/marketplace.json`
3. Auto-enable in `~/.claude/settings.json` (if Claude not running)
4. Print success message with skill names

**Uninstall script responsibilities:**
1. Remove symlink from `~/.claude/plugins/himalaya-mcp`
2. Remove entry from `~/.claude/local-marketplace/marketplace.json`
3. Print confirmation

### Phase 3: GitHub Marketplace + Official Directory

**Files to add to repo:**
- `.claude-plugin/marketplace.json` — Makes repo a self-hosted marketplace

```json
{
  "name": "himalaya-mcp-marketplace",
  "owner": { "name": "Data-Wise" },
  "plugins": [{
    "name": "himalaya-mcp",
    "source": ".",
    "description": "Privacy-first email MCP server wrapping himalaya CLI"
  }]
}
```

**Official directory submission:**
- Submit via https://clau.de/plugin-directory-submission
- Requires: quality review, README, working plugin structure

### Phase 4: Claude Desktop Setup CLI

**File:** `src/cli/setup.ts` (new)

**Commands:**
```bash
himalaya-mcp setup          # Add MCP server to Claude Desktop config
himalaya-mcp setup --check  # Verify configuration
himalaya-mcp setup --remove # Remove MCP server entry
```

**Config path:** `~/Library/Application Support/Claude/claude_desktop_config.json`

**Logic:**
1. Read existing config (or create empty)
2. Add/update `mcpServers.himalaya` entry
3. Write back (preserving other servers)
4. Print "Restart Claude Desktop to activate"

---

## API Design

N/A — No new MCP tools. This is a packaging/distribution feature.

---

## Data Models

N/A — No data model changes.

---

## Dependencies

| Dependency | Purpose | Phase |
|------------|---------|-------|
| esbuild | Bundle dist/index.js (dev dependency) | 1 |
| himalaya (Homebrew) | Email CLI backend | 2 |
| node (Homebrew) | MCP server runtime | 2 |
| jq (optional, Homebrew) | Auto-enable in settings.json | 2 |

---

## UI/UX Specifications

N/A — CLI only. No visual UI.

### User Flow

```
Install:
  brew tap data-wise/tap
  brew install himalaya-mcp
  → "himalaya-mcp plugin installed to ~/.claude/plugins/himalaya-mcp"
  → "Plugin auto-enabled in Claude Code"
  → "5 skills available: /email:inbox, /email:triage, ..."

Use in Claude Code:
  /email:inbox          → Lists recent emails
  /email:triage         → Classify and prioritize
  /email:digest         → Daily summary
  /email:reply          → Draft a reply

Use in Claude Desktop:
  himalaya-mcp setup    → Configures MCP server
  → Restart Claude Desktop
  → Email tools available
```

---

## Open Questions

1. **esbuild + ESM** — The MCP SDK uses ESM. Does esbuild handle the zod/v4 import map correctly? Need to test the bundle runs standalone.

2. **`depends_on "node"`** — Homebrew's node formula is large. Should we use `depends_on "node@22"` for stability, or just `"node"`?

3. **plugin.json version** — Currently `0.1.0`. Should bump to `1.0.0` to match the npm package version before publishing the formula.

4. **Homebrew sandbox** — Does `npm run build` work in Homebrew's sandboxed build environment? May need to pre-build and include `dist/` in the tarball.

5. **`${CLAUDE_PLUGIN_ROOT}` through symlinks** — Key risk. Need to verify Claude Code resolves the plugin root correctly when installed via symlink (not direct path).

---

## Review Checklist

- [ ] esbuild bundle runs standalone (`node dist/index.js`)
- [ ] All 122 tests pass with bundled output
- [ ] Formula installs cleanly on fresh system
- [ ] Plugin loads in Claude Code (skills + MCP server)
- [ ] Uninstall cleans up all artifacts
- [ ] Upgrade preserves user configuration
- [ ] `claude plugin add github:Data-Wise/himalaya-mcp` works
- [ ] Claude Desktop setup command works
- [ ] README documents all install methods

---

## Implementation Notes

### Key Risk: esbuild Bundle

The biggest technical risk is the esbuild step. The MCP SDK uses:
- `zod/v4` (import map in package.json)
- Dynamic `import()` for some modules
- `@modelcontextprotocol/sdk/server/mcp.js` subpath exports

**Mitigation:** Test the bundle immediately. If esbuild can't handle the import map, fall back to shipping `node_modules` (72MB, but proven to work).

### Craft.rb as Template

The craft formula (`~/projects/dev-tools/homebrew-tap/Formula/craft.rb`) is the direct template. himalaya-mcp adds:
- `depends_on "himalaya"` (new — craft has no system deps)
- `depends_on "node"` (new — craft is pure markdown/shell)
- Build step (`npm run build:bundle`)
- Claude Desktop caveats (MCP server config snippet)

### Version Bump

Before creating the formula:
- Bump `plugin.json` version `0.1.0` → `1.1.0`
- Bump `package.json` version `1.0.0` → `1.1.0`
- Tag `v1.1.0` release on GitHub
- Use the tarball URL in the formula

### Implementation Order

```
Phase 1: esbuild bundle        (30 min)
  → Add esbuild dev dep
  → Create build:bundle script
  → Test standalone execution
  → Verify tests pass

Phase 2: Homebrew formula       (2 hours)
  → Create formula in homebrew-tap
  → Write install/uninstall scripts
  → Test full lifecycle
  → Push formula

Phase 3: GitHub marketplace     (15 min)
  → Add marketplace.json to repo
  → Test: claude plugin add github:Data-Wise/himalaya-mcp

Phase 4: Official directory     (15 min)
  → Submit via form
  → Wait for review

Phase 5: Claude Desktop setup   (1 hour)
  → Create src/cli/setup.ts
  → Add bin entry to package.json
  → Test setup/check/remove commands
  → Add to formula caveats
```

---

## History

| Date | Change |
|------|--------|
| 2026-02-14 | Initial spec from brainstorm (plugin packaging & distribution) |
