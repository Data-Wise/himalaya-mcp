# CLI Reference

The `himalaya-mcp` binary provides commands for setup, diagnostics, and extension management.

---

## `himalaya-mcp --help`

Standard help flag. Prints a versioned, grouped usage summary to stdout and exits 0.

```bash
himalaya-mcp --help   # also: -h, help
```

Unknown commands write a short hint to stderr and exit 1, so scripts can detect typos:

```bash
$ himalaya-mcp foo
himalaya-mcp: unknown command 'foo'
Run 'himalaya-mcp --help' for usage.
$ echo $?
1
```

---

## `himalaya-mcp --version`

Prints the semantic version on its own line and exits 0.

```bash
himalaya-mcp --version   # also: -v, version
# Example output: 2.0.5
```

---

## `himalaya-mcp doctor`

Diagnose your himalaya-mcp installation across the full stack: prerequisites, MCP server health, per-account email connectivity, Claude Desktop extension state, Claude Code plugin registration, and environment variables.

```bash
himalaya-mcp doctor                    # Run all checks (per-account by default)
himalaya-mcp doctor --account <name>   # Scope to one configured account
himalaya-mcp doctor --fix              # Auto-fix common issues
himalaya-mcp doctor --json             # Machine-readable output
himalaya-mcp doctor --pre-release      # Maintainer-only: build/version/CHANGELOG/test gate before a release
himalaya-mcp doctor --post-release     # Maintainer-only: verify plugin install + MCP handshake after a release
```

### Check categories

| Category | What it checks |
|----------|---------------|
| Prerequisites | Node.js version, himalaya binary, himalaya config |
| MCP Server | `dist/index.js` exists and is non-empty |
| Email Connectivity | Account list, folder list, envelope fetch |
| Desktop Extension | Extension dir, manifest, registry, settings, user_config |
| Claude Code Plugin | Symlink, plugin.json, marketplace registration, plugin version vs installed binary, marketplace source version + symlink state |
| Plugin Cache | Stale cache at `~/.claude/plugins/cache/` |
| Environment | `HIMALAYA_*` env vars, unresolved template variables |

### Auto-fixable issues

| Issue | Fix |
|-------|-----|
| `himalaya_binary` empty in Desktop settings | Set to `which himalaya` result |
| Settings file missing | Create default settings (enabled, empty config) |
| Stale plugin cache | Remove cached metadata from `~/.claude/plugins/cache/` |
| Stale plugin directory copy | Deletes the `~/.claude/plugins/himalaya-mcp` (or `~/.claude/local-marketplace/himalaya-mcp`) directory copy and relinks it to the Homebrew `libexec` install so `brew upgrade` propagates |

### Pre-release / post-release checks

Two maintainer-only modes support the release pipeline rather than end-user diagnostics:

| Flag | Category | Checks |
|------|----------|--------|
| `--pre-release` | Pre-Release | Build exists, TypeScript compiles, version sync (package.json ↔ plugin.json ↔ `src/index.ts`), CHANGELOG has an entry for the current version, git tree clean, full test suite passes |
| `--post-release` | Post-Release | Plugin symlink installed, `plugin.json` valid, MCP server handshake succeeds, marketplace registration present, skills directory populated |

Both support `--json` and skip the per-account connectivity checks entirely (`--account` is ignored in these modes).

### Sample output

```
himalaya-mcp doctor

  Prerequisites
  ✓ Node.js 22.14.0
  ✓ himalaya found at /opt/homebrew/bin/himalaya
  ✓ himalaya config exists

  MCP Server
  ✓ dist/index.js exists (604 KB)

  Email Connectivity
  ✓ Accounts: personal, work
  ✓ Folders accessible (14 folders)
  ✓ Envelopes accessible

  Summary: 11 passed, 0 warnings, 1 failed
```

### JSON output

```json
[
  {
    "name": "Node.js installed",
    "category": "Prerequisites",
    "status": "pass",
    "message": "Node.js v22.14.0"
  },
  {
    "name": "himalaya_binary configured",
    "category": "Desktop Extension",
    "status": "fail",
    "message": "user_config.himalaya_binary is empty",
    "fix": { "description": "Set to /opt/homebrew/bin/himalaya" }
  }
]
```

!!! tip "Run after installation"
    Run `himalaya-mcp doctor` after any installation method to verify everything is connected correctly. Use `--fix` to resolve common issues automatically.

---

## `himalaya-mcp setup`

Configure himalaya-mcp as an MCP server for Claude Desktop (legacy `mcpServers` approach).

```bash
himalaya-mcp setup           # Add MCP server to Claude Desktop config
himalaya-mcp setup --check   # Verify configuration exists and paths are valid
himalaya-mcp setup --remove  # Remove the server entry
```

### Config path (per platform)

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%/Claude/claude_desktop_config.json` |

The setup command preserves all existing MCP servers in the config file. Only the `himalaya` entry is added, updated, or removed.

---

## `himalaya-mcp install-ext`

Install a `.mcpb` Desktop Extension into Claude Desktop.

```bash
himalaya-mcp install-ext                              # Auto-find .mcpb in project root
himalaya-mcp install-ext himalaya-mcp-v2.0.2.mcpb     # Install specific file
```

### What it does

1. Unpacks the `.mcpb` to `~/Library/Application Support/Claude/Claude Extensions/himalaya-mcp/`
2. Registers the extension in `extensions-installations.json` with SHA256 hash
3. Creates default settings (enabled, empty user config)
4. Restart Claude Desktop to activate

**Auto-discovery:** If no file path is given, searches the project root for `himalaya-mcp-v*.mcpb` and picks the latest version.

!!! tip "When to use"
    Use `install-ext` for local development and testing. For production installs, download the `.mcpb` from [GitHub Releases](https://github.com/Data-Wise/himalaya-mcp/releases) and double-click to install via Claude Desktop's GUI.

---

## `himalaya-mcp remove-ext`

Remove the himalaya-mcp Desktop Extension from Claude Desktop.

```bash
himalaya-mcp remove-ext
```

### What it removes

- Extension directory (`Claude Extensions/himalaya-mcp/`)
- Registry entry from `extensions-installations.json`
- Settings file (`Claude Extensions Settings/himalaya-mcp.json`)

Restart Claude Desktop after removal.

!!! note "See also"
    **[Desktop Extensions Reference](desktop-extensions.md)** for full details on the `.mcpb` format, manifest schema, and installation mechanism.

---

## Build Commands

```bash
npm run build           # TypeScript compilation (development)
npm run build:bundle    # Build root + plugin bundles (~908KB each, production)
npm run build:mcpb      # Build .mcpb Desktop Extension (~253KB)
npm test                # Run 691 tests (vitest, threads pool)
node dist/index.js      # Start MCP server standalone
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HIMALAYA_BINARY` | `himalaya` | Path to himalaya binary |
| `HIMALAYA_ACCOUNT` | (system default) | Default email account name |
| `HIMALAYA_FOLDER` | `INBOX` | Default folder for operations |
| `HIMALAYA_TIMEOUT` | `120000` (2 min) | Command timeout in ms (0 = unlimited) |
