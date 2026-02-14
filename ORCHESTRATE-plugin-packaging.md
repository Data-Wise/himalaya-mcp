# Plugin Packaging Orchestration Plan

> **Branch:** `feature/plugin-packaging`
> **Base:** `dev`
> **Worktree:** `~/.git-worktrees/himalaya-mcp/feature-plugin-packaging`
> **Spec:** `docs/specs/SPEC-plugin-packaging-2026-02-14.md`

## Objective

Package himalaya-mcp as a proper Claude Code plugin distributed via Homebrew (matching craft/scholar pattern) with zero-config install experience.

## Phase Overview

| Phase | Task | Priority | Status | Agent |
| ----- | ---- | -------- | ------ | ----- |
| 1 | esbuild bundle (eliminate node_modules) | High | Pending | Agent A |
| 2 | Homebrew formula + install scripts | High | Pending | Agent B (after Phase 1) |
| 3 | GitHub marketplace.json | Medium | Pending | Agent C (parallel with Phase 2) |
| 4 | Version bump + release tag | Medium | Pending | Sequential |
| 5 | Claude Desktop setup CLI | Low | Pending | Agent D (parallel with Phase 4) |

## Parallel Execution Strategy

```
Phase 1 (Agent A): esbuild bundle
  │
  ├──────────────────────┐
  │                      │
Phase 2 (Agent B):     Phase 3 (Agent C):
  Homebrew formula       marketplace.json
  install/uninstall      + test github install
  scripts
  │                      │
  ├──────────────────────┘
  │
Phase 4 (Sequential):
  Version bump + tag v1.1.0
  │
Phase 5 (Agent D):
  Claude Desktop setup CLI
```

### Agent A: esbuild Bundle

**Files to create/modify:**
- `package.json` — Add esbuild dev dep, `build:bundle` script
- `tsconfig.json` — Verify ESM compatibility

**Steps:**
1. Install esbuild as dev dependency
2. Add `"build:bundle": "esbuild src/index.ts --bundle --platform=node --target=node22 --outfile=dist/index.js --format=esm"` to package.json
3. Run bundle and test: `node dist/index.js` starts MCP server
4. Verify all 122 tests still pass
5. Measure bundle size (target: < 500KB)

**Key risk:** zod/v4 import map + MCP SDK subpath exports. If esbuild fails, fall back to `npm install --production` (72MB).

### Agent B: Homebrew Formula

**Files to create:**
- `~/projects/dev-tools/homebrew-tap/Formula/himalaya-mcp.rb`

**Template:** Copy from `craft.rb`, adapt for:
- `depends_on "himalaya"` + `depends_on "node"`
- Build step: `npm run build:bundle` (from Phase 1)
- No `node_modules` in libexec (just dist/ + plugin/ + .claude-plugin/)
- `himalaya-mcp-install` script (symlink + marketplace + auto-enable)
- `himalaya-mcp-uninstall` script (cleanup)
- Claude Desktop caveats (MCP server config snippet)

**Depends on:** Phase 1 complete (need bundle strategy confirmed).

### Agent C: GitHub Marketplace

**Files to create:**
- `.claude-plugin/marketplace.json`

**Content:**
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

**Can run in parallel with Phase 2.**

### Agent D: Claude Desktop Setup CLI

**Files to create:**
- `src/cli/setup.ts` — Setup command implementation
- Update `package.json` bin entry

**Commands:**
```bash
himalaya-mcp setup          # Add MCP server to Claude Desktop config
himalaya-mcp setup --check  # Verify configuration
himalaya-mcp setup --remove # Remove MCP server entry
```

**Config path:** `~/Library/Application Support/Claude/claude_desktop_config.json`

## Acceptance Criteria

- [ ] `node dist/index.js` starts MCP server (no node_modules needed)
- [ ] Bundle size < 500KB
- [ ] All 122 tests pass
- [ ] Homebrew formula installs cleanly
- [ ] Plugin loads in Claude Code (skills + MCP server)
- [ ] `${CLAUDE_PLUGIN_ROOT}` resolves through symlink
- [ ] marketplace.json validates
- [ ] `brew uninstall` cleans up all artifacts
- [ ] plugin.json version bumped to 1.1.0

## How to Start

```bash
cd ~/.git-worktrees/himalaya-mcp/feature-plugin-packaging
claude
# Then: "Start Phase 1 — esbuild bundle"
```
