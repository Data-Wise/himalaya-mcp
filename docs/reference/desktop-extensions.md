# Claude Desktop Extensions (.mcpb) Reference

Technical reference for the `.mcpb` Desktop Extension format used to package himalaya-mcp for Claude Desktop.

## Overview

A `.mcpb` file (formerly `.dxt`) is a ZIP archive containing an MCP server bundle and a `manifest.json` descriptor. Claude Desktop unpacks it to `~/Library/Application Support/Claude/Claude Extensions/<id>/` and registers it in `extensions-installations.json`.

### History

| Version | Name | Status |
|---------|------|--------|
| 0.1 | `.dxt` (Desktop Extension) | Deprecated |
| 0.2 | `.mcpb` | Superseded |
| 0.3 | `.mcpb` | **Current** |

The format was renamed from `.dxt` to `.mcpb` in early 2026. The `dxt_version` manifest field became `manifest_version`.

## manifest.json Schema

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `manifest_version` | `"0.3"` | Schema version |
| `name` | string | Extension identifier (kebab-case, unique) |
| `version` | string | Semantic version (e.g., `"1.2.1"`) |
| `description` | string | Short description (one sentence) |
| `author` | object | `{ name: string, url?: string }` |
| `server` | object | Server configuration (see below) |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `display_name` | string | Human-readable name shown in UI |
| `long_description` | string | Extended description |
| `icon` | string | Path to icon file (relative to manifest) |
| `license` | string | SPDX license identifier |
| `homepage` | string | Project URL |
| `repository` | object | `{ type: "git", url: string }` |
| `documentation` | string | Docs URL |
| `support` | string | Support URL |
| `keywords` | string[] | Discovery tags |
| `privacy_policies` | string[] | Privacy policy URLs |
| `user_config` | object | User-configurable settings (see below) |
| `tools` | array | Static tool declarations |
| `tools_generated` | boolean | If `true`, tools are generated at runtime |
| `prompts` | array | Static prompt declarations |
| `prompts_generated` | boolean | If `true`, prompts are generated at runtime |
| `compatibility` | object | Platform and runtime requirements |

### server

```json
{
  "type": "node",
  "entry_point": "dist/index.js",
  "mcp_config": {
    "command": "node",
    "args": ["${__dirname}/dist/index.js"],
    "env": {
      "HIMALAYA_BINARY": "${user_config.himalaya_binary}",
      "HIMALAYA_ACCOUNT": "${user_config.himalaya_account}"
    }
  }
}
```

| Field | Description |
|-------|-------------|
| `type` | Runtime type: `"node"` or `"python"` |
| `entry_point` | Main file relative to manifest |
| `mcp_config.command` | Binary to execute |
| `mcp_config.args` | Command arguments (supports template variables) |
| `mcp_config.env` | Environment variables (supports template variables) |

### user_config

User-configurable settings that appear in Claude Desktop's extension settings UI.

```json
{
  "himalaya_binary": {
    "type": "file",
    "title": "Himalaya Binary",
    "description": "Path to himalaya CLI binary",
    "required": false
  },
  "himalaya_account": {
    "type": "string",
    "title": "Default Account",
    "description": "Email account name from himalaya config",
    "required": false
  },
  "himalaya_folder": {
    "type": "string",
    "title": "Default Folder",
    "default": "INBOX",
    "required": false
  }
}
```

**Field types:**

| Type | UI Control | Description |
|------|-----------|-------------|
| `string` | Text input | Free-form text |
| `number` | Number input | Numeric value |
| `boolean` | Toggle | True/false |
| `file` | File picker | Path to a file |
| `directory` | Folder picker | Path to a directory |

Each config field supports: `title`, `description`, `required`, `default`, `multiple` (for arrays).

### tools and prompts

Static declarations for discovery. Each entry has `name` and `description`. Prompts additionally require `text` and optional `arguments`.

```json
{
  "tools": [
    { "name": "list_emails", "description": "List emails in a folder" }
  ],
  "prompts": [
    {
      "name": "triage_inbox",
      "description": "Classify emails as actionable, FYI, or skip",
      "arguments": [{ "name": "count", "description": "Number of emails", "required": false }],
      "text": "Triage the inbox..."
    }
  ]
}
```

If your server generates tools/prompts dynamically, set `tools_generated: true` / `prompts_generated: true` instead.

### compatibility

```json
{
  "platforms": ["darwin"],
  "runtimes": { "node": ">=22.0.0" }
}
```

Platforms: `darwin`, `win32`, `linux`.

## Template Variables

Variables are expanded at runtime by Claude Desktop:

| Variable | Expands To |
|----------|-----------|
| `${__dirname}` | Absolute path to the unpacked extension directory |
| `${user_config.<key>}` | Value from user's extension settings |
| `${HOME}` | User's home directory |

Example: `${__dirname}/dist/index.js` becomes `/Users/dt/Library/Application Support/Claude/Claude Extensions/himalaya-mcp/dist/index.js`.

## .mcpbignore

Controls which files are excluded from the `.mcpb` archive. Syntax follows `.gitignore`:

```
node_modules/
src/
tests/
docs/
*.ts
*.md
.git*
.env*
```

Place in the same directory as `manifest.json`.

## CLI Tool (@anthropic-ai/mcpb)

Install: `npm install -g @anthropic-ai/mcpb` or use via `npx`.

| Command | Description |
|---------|-------------|
| `mcpb init` | Create a new manifest.json interactively |
| `mcpb validate <dir>` | Validate manifest.json schema |
| `mcpb pack <dir>` | Create .mcpb archive from directory |
| `mcpb unpack <file> [output]` | Extract .mcpb to directory |
| `mcpb info <file>` | Show .mcpb metadata (name, version, size, files) |
| `mcpb sign <file>` | Sign .mcpb with a key |
| `mcpb verify <file>` | Verify .mcpb signature |
| `mcpb unsign <file>` | Remove signature |
| `mcpb clean <dir>` | Remove build artifacts |

### Validation

```bash
npx @anthropic-ai/mcpb validate mcpb/
```

Checks: required fields, type correctness, prompt `text` fields, user_config types, version format.

### Packing

```bash
npx @anthropic-ai/mcpb pack mcpb/
```

Creates `mcpb.mcpb` in the current directory (named after the directory, not the extension name).

## Installation Mechanism

### Claude Desktop GUI

Double-click a `.mcpb` file or use File > Install Extension in Claude Desktop.

### CLI (himalaya-mcp)

```bash
himalaya-mcp install-ext himalaya-mcp-v1.3.0.mcpb   # Install
himalaya-mcp remove-ext                               # Uninstall
```

### What Install Does

1. **Unpacks** the .mcpb to `~/Library/Application Support/Claude/Claude Extensions/<id>/`
2. **Registers** in `extensions-installations.json` with id, version, SHA256 hash, timestamp, full manifest, signature status, and source
3. **Creates settings** in `Claude Extensions Settings/<id>.json` with `isEnabled: true` and empty `userConfig`
4. **Restart required** — Claude Desktop reads extensions on startup

### Installation Files

| File | Purpose |
|------|---------|
| `Claude Extensions/<id>/manifest.json` | Extension manifest |
| `Claude Extensions/<id>/dist/index.js` | Server bundle |
| `extensions-installations.json` | Registry of all installed extensions |
| `Claude Extensions Settings/<id>.json` | Per-extension settings (enabled, userConfig) |

### Registry Entry Format

```json
{
  "extensions": {
    "himalaya-mcp": {
      "id": "himalaya-mcp",
      "version": "1.3.0",
      "hash": "f099...",
      "installedAt": "2026-02-17T06:33:25.366Z",
      "manifest": { /* full manifest.json content */ },
      "signatureInfo": { "status": "unsigned" },
      "source": "local"
    }
  }
}
```

Source values: `"registry"` (from Anthropic registry), `"local"` (manual install).

### Settings File Format

```json
{
  "isEnabled": true,
  "userConfig": {
    "himalaya_binary": "/opt/homebrew/bin/himalaya",
    "himalaya_account": "work"
  }
}
```

## Build Pipeline (himalaya-mcp)

```
src/index.ts (16 source files)
    │
    ├── npm run build:bundle    →  dist/index.js (595 KB, esbuild)
    │
    ├── copy to mcpb/dist/      →  mcpb/dist/index.js
    │
    ├── mcpb validate mcpb/     →  Schema check
    │
    └── mcpb pack mcpb/         →  himalaya-mcp-v1.3.0.mcpb (147 KB)
```

Run: `npm run build:mcpb`

### What's in the .mcpb

| File | Size | Purpose |
|------|------|---------|
| `manifest.json` | 6.3 KB | Extension descriptor |
| `dist/index.js` | 595.3 KB | esbuild bundle (all deps inlined) |
| **Total (compressed)** | **~147 KB** | ZIP archive |

## Signing

Extensions can be signed for authenticity verification. himalaya-mcp is currently unsigned (open source, distributed via GitHub Releases).

```bash
mcpb sign himalaya-mcp-v1.3.0.mcpb --key private.pem
mcpb verify himalaya-mcp-v1.3.0.mcpb --key public.pem
```

## CI/CD Integration

### CI Validation (.github/workflows/ci.yml)

```yaml
validate-mcpb:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: 22, cache: npm }
    - run: npm ci
    - run: npx --yes @anthropic-ai/mcpb validate mcpb/
    - run: npm run build:mcpb
    - run: |
        MCPB_FILE=$(ls himalaya-mcp-v*.mcpb 2>/dev/null | head -1)
        test -f "$MCPB_FILE" && echo "MCPB OK: $MCPB_FILE"
```

### Release Upload (.github/workflows/homebrew-release.yml)

The `.mcpb` is built during the release validation job and uploaded to the GitHub Release as an artifact.

## Comparison: mcpServers vs Extensions

| Aspect | mcpServers (legacy) | .mcpb Extension |
|--------|-------------------|----------------|
| Config file | `claude_desktop_config.json` | `Claude Extensions/` directory |
| Setup | Manual JSON editing or `himalaya-mcp setup` | Double-click .mcpb or `install-ext` |
| User config | Environment variables | GUI settings panel |
| Discovery | Manual | Extension gallery |
| Updates | Manual | Extension update mechanism |
| CLI | `himalaya-mcp setup` | `himalaya-mcp install-ext` |

Both approaches work simultaneously. The extension approach is recommended for new installations.
