# .mcpb Packaging for Claude Desktop One-Click Install

**Generated:** 2026-02-17
**Context:** himalaya-mcp v1.2.0
**Mode:** feature | **Depth:** max (2 agents)

## Overview

Package himalaya-mcp as a `.mcpb` Desktop Extension for Claude Desktop, enabling one-click installation instead of manual `claude_desktop_config.json` editing. Two variants: lightweight (no binary, ~150 KB) and bundled (universal himalaya binary, ~19 MB).

## Agent Research Findings

### Agent 1: .mcpb Format Details

**manifest.json schema (v0.3):**

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `manifest_version` | Yes | string | `"0.3"` |
| `name` | Yes | string | Machine-readable ID (`himalaya-mcp`) |
| `version` | Yes | string | SemVer (`1.2.0`) |
| `description` | Yes | string | Brief explanation |
| `author` | Yes | object | `{ name, email?, url? }` |
| `server` | Yes | object | Runtime config (type, entry_point, mcp_config) |
| `display_name` | No | string | Human-friendly UI name |
| `tools` | No | array | Static tool declarations |
| `prompts` | No | array | Static prompt declarations |
| `user_config` | No | object | Install dialog fields |
| `compatibility` | No | object | Platform/runtime constraints |
| `keywords` | No | array | Search terms |
| `license` | No | string | License identifier |

**Server types:** `node`, `python`, `binary`, `uv`

**user_config field types:**

| Type | UI Element | Notes |
|------|-----------|-------|
| `string` | Text field | Supports `sensitive: true` (keychain storage) |
| `number` | Number field | Supports `min`/`max` |
| `boolean` | Checkbox | |
| `directory` | Directory picker | Supports `multiple: true` |
| `file` | File picker | Supports `multiple: true` |

**Variable substitution:** `${__dirname}`, `${user_config.KEY}`, `${HOME}`

**Platform overrides:**
```json
{
  "server": {
    "mcp_config": {
      "platforms": {
        "darwin": { "env": { "TMPDIR": "${TMPDIR}" } },
        "win32": { "command": "node.exe" }
      }
    }
  }
}
```

**mcpb CLI commands:** `init`, `validate`, `pack`, `sign`, `verify`, `info`, `unsign`

**Auto-updates:** Official directory extensions only. Custom extensions require manual .mcpb reinstall (same `name` = update, different `name` = new extension).

### Agent 2: Binary Bundling Research

**Binary sizes (himalaya v1.1.0):**

| Type | Uncompressed | Compressed |
|------|-------------|------------|
| arm64 | 24 MB | 9.0 MB |
| x64 | 25 MB | 9.3 MB |
| Universal (lipo) | 49 MB | 18.3 MB |

**Code signing:** Unsigned binaries require manual Gatekeeper approval (System Settings > Privacy & Security > Open Anyway). Proper signing requires Apple Developer certificate ($99/yr) + notarization.

**Bundle size estimates:**

| Variant | Size | User Setup |
|---------|------|-----------|
| Lightweight (no binary) | ~150 KB | `brew install himalaya` |
| Bundled (universal) | ~19 MB | Gatekeeper approval |
| Bundled + signed | ~19 MB | None (frictionless) |

## Quick Wins (< 30 min each)

1. **Create manifest.json** - Node server type, dist/index.js entry, declare all 19 tools + 4 prompts
2. **Add user_config** - himalaya binary path (file), default account (string), default folder (string)
3. **Pack lightweight .mcpb** - `mcpb pack . himalaya-mcp-v1.2.0.mcpb` (~150 KB)

## Medium Effort (1-2 hours)

4. **Built-in account wizard** - user_config fields appear in Claude Desktop install dialog
5. **Build script** - `npm run build:mcpb` that validates + packs, add to CI
6. **Bundled variant** - Download arm64+x64, lipo universal, include in bundle (~19 MB)

## Long-term (Future sessions)

7. **Code signing** - Apple Developer account, sign + notarize universal binary
8. **Official directory** - Submit to Anthropic's extension directory for auto-updates
9. **Multi-platform** - Linux + Windows support via platform overrides

## Recommended Path

Start with **lightweight .mcpb** (no binary, ~150 KB):
- Quick to build and ship
- No code signing friction
- Users already have himalaya via Homebrew
- Add bundled variant as separate download later
- Code signing when user base justifies $99/yr investment

## Implementation Architecture

```
himalaya-mcp/
├── mcpb/                          # NEW: .mcpb build directory
│   ├── manifest.json              # Extension manifest
│   ├── dist/
│   │   └── index.js               # esbuild bundle (copied from dist/)
│   └── node_modules/              # Production deps only (if not bundled)
│
├── mcpb-bundled/                  # FUTURE: bundled variant
│   ├── manifest.json
│   ├── dist/index.js
│   ├── bin/
│   │   └── himalaya               # Universal binary (49 MB)
│   └── node_modules/
│
├── scripts/
│   └── build-mcpb.sh             # Build + pack script
│
└── .github/workflows/
    └── ci.yml                     # Add mcpb validation step
```

### manifest.json (Lightweight)

```json
{
  "manifest_version": "0.3",
  "name": "himalaya-mcp",
  "display_name": "Himalaya Email",
  "version": "1.2.0",
  "description": "Privacy-first email for Claude via the himalaya CLI",
  "author": {
    "name": "Data-Wise",
    "url": "https://github.com/Data-Wise"
  },
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/Data-Wise/himalaya-mcp"
  },
  "homepage": "https://data-wise.github.io/himalaya-mcp/",
  "documentation": "https://data-wise.github.io/himalaya-mcp/guide/guide/",
  "server": {
    "type": "node",
    "entry_point": "dist/index.js",
    "mcp_config": {
      "command": "node",
      "args": ["${__dirname}/dist/index.js"],
      "env": {
        "HIMALAYA_BINARY": "${user_config.himalaya_binary}",
        "HIMALAYA_ACCOUNT": "${user_config.himalaya_account}",
        "HIMALAYA_FOLDER": "${user_config.himalaya_folder}"
      }
    }
  },
  "tools": [
    { "name": "list_emails", "description": "List email envelopes in a folder" },
    { "name": "search_emails", "description": "Search emails by query" },
    { "name": "read_email", "description": "Read email body (plain text)" },
    { "name": "read_email_html", "description": "Read email body (HTML)" },
    { "name": "flag_email", "description": "Add or remove email flags" },
    { "name": "move_email", "description": "Move email to another folder" },
    { "name": "compose_email", "description": "Compose a new email" },
    { "name": "draft_reply", "description": "Generate reply template" },
    { "name": "send_email", "description": "Send email with safety gate" },
    { "name": "list_folders", "description": "List all email folders" },
    { "name": "create_folder", "description": "Create a new folder" },
    { "name": "delete_folder", "description": "Delete a folder" },
    { "name": "list_attachments", "description": "List email attachments" },
    { "name": "download_attachment", "description": "Download an attachment" },
    { "name": "extract_calendar_event", "description": "Extract calendar from email" },
    { "name": "create_calendar_event", "description": "Create calendar event" },
    { "name": "export_to_markdown", "description": "Export email as markdown" },
    { "name": "create_action_item", "description": "Extract action items" },
    { "name": "copy_to_clipboard", "description": "Copy text to clipboard" }
  ],
  "prompts": [
    { "name": "triage_inbox", "description": "Classify emails as actionable/FYI/skip" },
    { "name": "summarize_email", "description": "One-sentence summary + action items" },
    { "name": "daily_email_digest", "description": "Priority-grouped email digest" },
    { "name": "draft_reply", "description": "Guided reply composition" }
  ],
  "user_config": {
    "himalaya_binary": {
      "type": "file",
      "title": "Himalaya Binary",
      "description": "Path to himalaya CLI binary (leave empty to use system PATH)",
      "required": false
    },
    "himalaya_account": {
      "type": "string",
      "title": "Default Account",
      "description": "Default email account name from himalaya config",
      "required": false
    },
    "himalaya_folder": {
      "type": "string",
      "title": "Default Folder",
      "description": "Default email folder",
      "default": "INBOX",
      "required": false
    }
  },
  "compatibility": {
    "platforms": ["darwin"],
    "runtimes": {
      "node": ">=22.0.0"
    }
  },
  "keywords": ["email", "himalaya", "imap", "privacy", "inbox", "triage"]
}
```

## Trade-offs

| Decision | Option A | Option B | Recommendation |
|----------|----------|----------|----------------|
| Bundle binary? | Yes (~19 MB, self-contained) | No (~150 KB, needs brew) | **No** (ship lightweight first) |
| Universal vs platform-specific? | Universal (49 MB, simple) | Per-arch (24 MB, detection) | **Universal** (when bundling) |
| Code signing? | Sign ($99/yr, frictionless) | Unsigned (free, friction) | **Unsigned** (for now) |
| Server type | `node` (wrapper) | `binary` (direct) | **`node`** (our MCP server is Node.js) |
| Distribution | Self-host on GitHub | Official directory | **Self-host first** |
| Platforms | macOS only | Cross-platform | **macOS only** (v1) |

## Open Questions

1. Does `user_config` with empty file picker pass empty string or undefined to env?
2. Can we use `tools_generated: true` instead of listing all 19 tools statically?
3. What's the approval process for the official extension directory?
4. Does Claude Desktop's built-in Node.js runtime work, or must we specify system Node?

## Sources

- [MCPB GitHub](https://github.com/modelcontextprotocol/mcpb)
- [MANIFEST.md](https://github.com/modelcontextprotocol/mcpb/blob/main/MANIFEST.md)
- [Anthropic: Desktop Extensions](https://www.anthropic.com/engineering/desktop-extensions)
- [Building Desktop Extensions](https://support.claude.com/en/articles/12922929-building-desktop-extensions-with-mcpb)
- [himalaya releases](https://github.com/pimalaya/himalaya/releases)
- [Apple Codesign](https://gregoryszorc.com/docs/apple-codesign/stable/apple_codesign_gatekeeper.html)
