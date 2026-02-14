# Plugin Packaging & Distribution

himalaya-mcp is distributed as a Claude Code plugin via multiple channels. This guide covers the packaging architecture, build process, and how each distribution method works.

## Distribution Channels

| Channel | Command | Auto-setup |
|---------|---------|------------|
| **Homebrew** (recommended) | `brew install data-wise/tap/himalaya-mcp` | Symlink, marketplace, auto-enable |
| **GitHub** | `claude plugin marketplace add Data-Wise/himalaya-mcp` | Plugin cache |
| **Source** | `git clone` + `npm run build` | Manual symlink |
| **Claude Desktop** | `himalaya-mcp setup` | MCP server config |

## esbuild Bundle

The MCP server is bundled into a single file using esbuild, eliminating the 72MB `node_modules` directory.

### How it works

```bash
npm run build:bundle
# Equivalent to:
# esbuild src/index.ts --bundle --platform=node --target=node22 \
#   --outfile=dist/index.js --format=esm --minify
```

**Input:** 16 TypeScript source files + `@modelcontextprotocol/sdk` dependency

**Output:** Single `dist/index.js` (583KB minified)

The bundle includes all dependencies (MCP SDK, zod) inlined. No runtime `node_modules` needed -- just `node dist/index.js`.

### Why esbuild

- **72MB to 583KB** -- node_modules eliminated entirely
- **Zero runtime deps** -- single file ships in Homebrew formula
- **Fast** -- builds in ~25ms
- **ESM compatible** -- handles zod/v4 import maps and MCP SDK subpath exports

### Build scripts

| Script | Purpose | Output |
|--------|---------|--------|
| `npm run build` | TypeScript compilation (development) | `dist/*.js` + `.d.ts` + sourcemaps |
| `npm run build:bundle` | esbuild single-file (production) | `dist/index.js` (583KB) |

## Homebrew Formula

The formula lives in the [homebrew-tap](https://github.com/Data-Wise/homebrew-tap) repository at `Formula/himalaya-mcp.rb`.

### What `brew install` does

1. **Downloads** the release tarball from GitHub
2. **Installs dependencies** -- `himalaya` (email CLI) + `node` (runtime)
3. **Builds** -- runs `npm install` then `npm run build:bundle`
4. **Installs to libexec** -- only `.claude-plugin/`, `.mcp.json`, `plugin/`, `dist/`
5. **Runs post-install** -- `himalaya-mcp-install` script

### Post-install script

The `himalaya-mcp-install` script (created by the formula):

1. Symlinks `libexec` to `~/.claude/plugins/himalaya-mcp`
2. Registers in `~/.claude/local-marketplace/marketplace.json`
3. Auto-enables in `~/.claude/settings.json` (skipped if Claude is running)
4. Uses stable `$(brew --prefix)/opt/himalaya-mcp/libexec` path (survives upgrades)

### Uninstall

`brew uninstall himalaya-mcp` runs the `himalaya-mcp-uninstall` script which:

1. Removes the plugin symlink
2. Removes the marketplace.json entry
3. Removes the marketplace symlink

### Upgrade

`brew upgrade himalaya-mcp` preserves user configuration. The symlink always points to the stable opt path, so upgrades are seamless.

## Release Automation

When a GitHub release is published, the `homebrew-release.yml` workflow automatically updates the Homebrew formula.

### Pipeline

```
GitHub Release (v1.2.0)
  │
  ├─ validate         Build + test + bundle, verify package.json matches tag
  │
  ├─ prepare          Download tarball, compute SHA256 (5 retries, 10s delay)
  │
  └─ update-homebrew  Call reusable update-formula.yml → PR to homebrew-tap
```

### How it works

1. **Trigger** — publish a GitHub release (or manual `workflow_dispatch`)
2. **Validate** — checks out the tag, runs `npm ci`, verifies `package.json` version matches the release tag, then builds, tests, and bundles
3. **Prepare** — downloads the release tarball with retry logic (GitHub tarballs take seconds to materialize), computes SHA256
4. **Update** — calls the reusable `Data-Wise/homebrew-tap/.github/workflows/update-formula.yml` workflow, which opens a PR to update `Formula/himalaya-mcp.rb` with the new version and SHA

### Manual trigger

For re-running or testing without creating a new release:

```
gh workflow run homebrew-release.yml \
  -f version=1.2.0 \
  -f auto_merge=true
```

### Required secret

`HOMEBREW_TAP_GITHUB_TOKEN` — a PAT with repo access to `Data-Wise/homebrew-tap`. Set via:

```bash
gh secret set HOMEBREW_TAP_GITHUB_TOKEN --repo Data-Wise/himalaya-mcp
```

## Marketplace Registration

The repository includes `.claude-plugin/marketplace.json` for GitHub-based plugin discovery:

```json
{
  "name": "himalaya-mcp-marketplace",
  "owner": { "name": "Data-Wise" },
  "plugins": [{
    "name": "himalaya-mcp",
    "source": "./",
    "description": "Privacy-first email MCP server wrapping himalaya CLI",
    "category": "productivity",
    "tags": ["email", "mcp", "himalaya", "privacy"]
  }]
}
```

This enables the GitHub install flow:

```bash
claude plugin marketplace add Data-Wise/himalaya-mcp
claude plugin install himalaya-mcp
```

## Claude Desktop Setup CLI

The `himalaya-mcp` CLI provides a setup command for Claude Desktop users:

```bash
himalaya-mcp setup           # Add MCP server to claude_desktop_config.json
himalaya-mcp setup --check   # Verify configuration exists and paths are valid
himalaya-mcp setup --remove  # Remove the server entry
```

**Config path:** `~/Library/Application Support/Claude/claude_desktop_config.json`

The setup command:

- Reads existing config (or creates a new one)
- Adds the `himalaya` MCP server entry
- Preserves all other existing servers
- Points to the plugin's `dist/index.js` via the standard plugin path

## What Ships in Each Channel

| Content | Homebrew | GitHub | Source |
|---------|----------|--------|--------|
| `dist/index.js` (bundle) | Built during install | Pre-built | Built locally |
| `.claude-plugin/plugin.json` | Stripped to essentials | Full | Full |
| `.claude-plugin/marketplace.json` | In libexec | In repo | In repo |
| `.mcp.json` | In libexec | In repo | In repo |
| `plugin/skills/*.md` | In libexec | In repo | In repo |
| `plugin/agents/*.md` | In libexec | In repo | In repo |
| `node_modules/` | Not shipped | Not shipped | Local only |
| `src/` | Not shipped | In repo | In repo |
| `tests/` | Not shipped | In repo | In repo |

## Version Management

Versions are synchronized across three files:

| File | Field | Purpose |
|------|-------|---------|
| `package.json` | `version` | npm package version |
| `.claude-plugin/plugin.json` | `version` | Claude Code plugin version |
| `src/index.ts` | `VERSION` | MCP server reported version |

All three must match. The Homebrew formula URL references the GitHub release tag (e.g., `v1.1.0`). The `homebrew-release.yml` validate job enforces this — a mismatch between the release tag and `package.json` version will fail the workflow.
