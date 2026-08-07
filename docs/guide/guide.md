# himalaya-mcp User Guide

Privacy-first email for Claude via the [himalaya](https://github.com/pimalaya/himalaya) CLI.

## How It Works

himalaya-mcp wraps the himalaya CLI as a subprocess, exposing email operations as MCP tools, resources, and prompts. Claude never touches raw IMAP/SMTP -- all authentication stays local on your machine.

```
Claude <──MCP──> himalaya-mcp <──execFile──> himalaya CLI <──IMAP/SMTP──> Mail Server
```

**Key design choices:**

- **Subprocess, not library** -- wraps the CLI binary via `execFile` (no shell injection)
- **Prompt-based AI** -- Claude IS the AI; MCP prompts guide triage/summarization
- **Two-phase send** -- `send_email` returns a preview first; requires `confirm=true` to actually send
- **Plugin-first** -- ships as a Claude Code plugin; also works as standalone MCP server

## Claude Code vs Claude Desktop

himalaya-mcp works with both Claude Code and Claude Desktop, but the experience differs:

| Feature | Claude Code | Claude Desktop |
|---------|-------------|----------------|
| 29 MCP tools | Yes | Yes |
| 7 MCP prompts | Yes | Yes |
| 3 MCP resources | Yes | Yes |
| `/himalaya:*` slash commands | Yes (16 skills) | No |
| Plugin hooks | Yes (2 hooks) | No |
| Email assistant agent | Yes | No |
| Natural language ("check my inbox") | Yes | Yes |
| Two-phase send safety gate | Yes | Yes |
| Env var configuration | Yes | Yes |

**In Claude Code**, the plugin system provides slash-command skills (`/himalaya:inbox`, `/himalaya:triage`, `/himalaya:search`, `/himalaya:manage`, `/himalaya:stats`, `/himalaya:config`, etc.) that orchestrate multi-step workflows, plus an autonomous email assistant agent and a pre-send confirmation hook. These are Claude Code-only features defined in the plugin manifest.

**In Claude Desktop**, you get the full MCP server -- all 29 tools, 7 prompts, and 3 resources work identically. You interact using natural language instead of slash commands. Say "check my inbox" and Claude calls `list_emails` directly. The two-phase send safety gate works the same way.

!!! tip "Which should I use?"
    Use **Claude Code** if you want the structured skill workflows and the email assistant agent. Use **Claude Desktop** if you prefer the desktop UI or want email access alongside other MCP servers.

## Prerequisites

1. **Node.js 22+**
2. **himalaya CLI** -- `brew install himalaya`
3. **Configured email** -- at least one account in `~/.config/himalaya/config.toml`

Verify himalaya works:

```bash
himalaya --output json envelope list     # Should print JSON envelopes
```

## Installation

### Homebrew (recommended)

```bash
brew tap data-wise/tap
brew install himalaya-mcp
```

Zero-config: installs dependencies, builds the bundle, symlinks the plugin, and auto-enables in Claude Code. See the [detailed installation guide](../getting-started/installation.md) for all options.

### From Source

```bash
git clone https://github.com/Data-Wise/himalaya-mcp.git
cd himalaya-mcp
npm install && npm run build
ln -s $(pwd) ~/.claude/plugins/himalaya-mcp
```

Restart Claude Code. The plugin provides 16 skills: `/himalaya:inbox`, `/himalaya:triage`, `/himalaya:digest`, `/himalaya:reply`, `/himalaya:compose`, `/himalaya:forward`, `/himalaya:attachments`, `/himalaya:export`, `/himalaya:threads`, `/himalaya:search`, `/himalaya:manage`, `/himalaya:stats`, `/himalaya:config`, `/himalaya:morning`, `/himalaya:help`, `/himalaya:respond`.

### Claude Desktop (.mcpb)

Download `himalaya-mcp-v{version}.mcpb` from [GitHub Releases](https://github.com/Data-Wise/himalaya-mcp/releases) and double-click to install in Claude Desktop. The `.mcpb` package is lightweight (~253 KB) and configures the MCP server automatically.

**Prerequisites:** himalaya CLI must be installed separately:

```bash
brew install himalaya
```

**User-configurable fields (set during install):**

| Field | Default | Description |
|-------|---------|-------------|
| himalaya binary path | `himalaya` | Path to himalaya binary (optional) |
| Default account | (system default) | Email account name (optional) |
| Default folder | `INBOX` | Folder for operations |

### Claude Desktop (CLI setup)

Alternatively, if you installed himalaya-mcp via Homebrew or from source, run the setup command:

```bash
himalaya-mcp setup           # Add MCP server to Desktop config
himalaya-mcp setup --check   # Verify configuration is correct
himalaya-mcp setup --remove  # Remove the server entry
```

Restart Claude Desktop after running setup.

#### What `setup` does

The `setup` command writes a server entry into Claude Desktop's config file. It preserves all existing MCP servers -- only the `himalaya` entry is added or updated.

**Config file location (per platform):**

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%/Claude/claude_desktop_config.json` |

**What gets written:**

```json
{
  "mcpServers": {
    "himalaya": {
      "command": "node",
      "args": ["~/.claude/plugins/himalaya-mcp/dist/index.js"]
    }
  }
}
```

Claude Desktop reads this on startup and spawns `node dist/index.js` as a subprocess. The MCP server communicates over stdin/stdout using JSON-RPC, exposing all 29 tools, 7 prompts, and 3 resources.

#### Using himalaya-mcp in Claude Desktop

Once configured, just talk naturally:

```
You: "Check my inbox"
You: "Triage my last 10 emails"
You: "Reply to the meeting email"
You: "Give me today's email digest"
You: "Find emails from Alice about the budget"
You: "Export email 42 as markdown"
```

Claude sees the MCP tools and calls them automatically. There are no slash commands -- everything is natural language.

#### Adding env vars (optional)

To customize the server behavior, add environment variables to the config:

```json
{
  "mcpServers": {
    "himalaya": {
      "command": "node",
      "args": ["~/.claude/plugins/himalaya-mcp/dist/index.js"],
      "env": {
        "HIMALAYA_ACCOUNT": "work",
        "HIMALAYA_TIMEOUT": "60000"
      }
    }
  }
}
```

#### Verifying the server works

Test the MCP server standalone:

```bash
echo '{}' | node ~/.claude/plugins/himalaya-mcp/dist/index.js
```

If you see a JSON-RPC response, the server is working. If Claude Desktop still can't connect, check the config path and restart Desktop.

## Configuration

All settings are optional. Set via environment variables in your MCP server config:

| Variable | Default | Description |
|----------|---------|-------------|
| `HIMALAYA_BINARY` | `himalaya` | Path to himalaya binary |
| `HIMALAYA_ACCOUNT` | (system default) | Default email account name |
| `HIMALAYA_FOLDER` | `INBOX` | Default folder for operations |
| `HIMALAYA_TIMEOUT` | `120000` (2 min) | Command timeout in milliseconds (0 = unlimited) |

Example with env vars:

```json
{
  "mcpServers": {
    "himalaya": {
      "command": "node",
      "args": ["/path/to/himalaya-mcp/dist/index.js"],
      "env": {
        "HIMALAYA_ACCOUNT": "work",
        "HIMALAYA_TIMEOUT": "60000"
      }
    }
  }
}
```

## MCP Tools (29)

### Reading

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_emails` | List envelopes in a folder | `page_size`, `page`, `folder`, `account` |
| `search_emails` | Search by subject, from, body, etc. | `query`, `folder`, `account` |
| `read_email` | Read plain text body | `id`, `folder`, `account` |
| `read_email_html` | Read HTML body | `id`, `folder`, `account` |

### Managing Folders

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_folders` | List all available folders | `account` |
| `create_folder` | Create a new folder | `name`, `account` |
| `delete_folder` | Delete an existing folder | `name`, `confirm`, `account` |

### Managing Emails

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `flag_email` | Add/remove flags (Seen, Flagged, Answered, etc.) | `id`, `flags`, `action` ("add"/"remove") |
| `move_email` | Move to another folder | `id`, `target_folder` |

### Composing

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `compose_email` | Compose a new email from scratch | `to`, `subject`, `body`, `attachments`, `account` |
| `draft_reply` | Generate reply template (does NOT send) | `id`, `body`, `reply_all` |
| `send_email` | Send with safety gate | `template`, `attachments`, `confirm` (must be `true` to send) |

### Attachments

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_attachments` | List all attachments in an email | `id`, `folder`, `account` |
| `download_attachment` | Download a specific attachment | `id`, `filename`, `folder`, `account` |

### Calendar

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `extract_calendar_event` | Extract calendar event details from email | `id`, `folder`, `account` |
| `create_calendar_event` | Create calendar event from extracted data | `summary`, `dtstart`, `dtend`, `location`, `confirm` |

### Exporting

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `export_to_markdown` | Email to markdown with YAML frontmatter | `id`, `folder`, `account` |
| `create_action_item` | Extract todos, deadlines, commitments | `id`, `folder`, `account` |
| `copy_to_clipboard` | Copy text to system clipboard | `text` |

### Threads

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_threads` | List email threads grouped by conversation | `folder`, `page_size`, `account` |
| `read_thread` | Read all messages in a thread chronologically | `thread_id`, `folder`, `account` |

### Diagnostics

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `health_check` | Check himalaya-mcp installation health and per-account IMAP connectivity | `account` (optional) |

#### `health_check`

Returns `overall` status (`healthy` / `degraded` / `broken`), the detected himalaya version and binary path, plus a per-account detail array. Each account is probed on **two surfaces** — the folder list and an envelope fetch — so a folder failure and an envelope failure are reported separately instead of collapsing into one generic unreachable state. Use it when an email tool fails — Claude can call `health_check` to diagnose which accounts are reachable and surface the per-account `hint` from the structured error envelope.

**Arguments:**

- `account` (optional) — Specific account to test. Defaults to all configured accounts.

**Example response:**

```json
{
  "overall": "degraded",
  "himalayaVersion": "himalaya v2.0.0 ...",
  "himalayaBinary": "/opt/homebrew/bin/himalaya",
  "accounts": [
    {
      "name": "unm",
      "reachable": false,
      "code": "imap_auth_failed",
      "hint": "Re-check app password. Run: himalaya account configure <account>",
      "surfaces": {
        "folders": { "ok": false, "code": "imap_auth_failed", "message": "AUTHENTICATIONFAILED" },
        "envelopes": { "ok": true }
      }
    },
    {
      "name": "personal",
      "reachable": true,
      "surfaces": { "folders": { "ok": true }, "envelopes": { "ok": true } }
    }
  ]
}
```

`reachable` reflects the folder surface (primary); a failing envelope surface alone leaves the account reachable but degrades `overall` and is reported in `surfaces`. The same probing logic powers `himalaya-mcp doctor`'s per-account checks, so the two never drift.

If any tool fails, also see the [troubleshooting guide](troubleshooting.md).

## MCP Prompts (7)

Prompts guide Claude's reasoning for email tasks. Use them via the MCP prompt interface or through the plugin skills.

| Prompt | Purpose | Parameters |
|--------|---------|------------|
| `triage_inbox` | Classify emails as actionable/FYI/skip, suggest flags and moves | `count` (default: 10) |
| `summarize_email` | One-sentence summary + action items + priority | `id`, `folder` |
| `daily_email_digest` | Markdown digest grouped by priority (action/FYI/low) | (none) |
| `weekly_email_digest` | Weekly digest grouped by priority and day | (none) |
| `draft_reply` | Compose a reply with tone guidance and safety reminders | `id`, `tone`, `instructions` |
| `morning_briefing` | Morning email briefing with urgency classification | `account` |
| `inbox_check` | Quick inbox status with highlights and next actions | `folder`, `account` |

## MCP Resources (3)

Resources provide browsable email data without requiring tool calls.

| Resource | URI | Returns |
|----------|-----|---------|
| Inbox listing | `email://inbox` | Recent envelopes with sender, subject, date |
| Message by ID | `email://message/{id}` | Full plain text body |
| Folder list | `email://folders` | All available folders |

## Multi-Account Support

Every tool accepts an optional `account` parameter matching a himalaya account name from your config. Set a default with `HIMALAYA_ACCOUNT` env var, then override per-call:

```
"List emails from my work account"    -> list_emails(account: "work")
"Search personal for receipts"        -> search_emails(query: "receipts", account: "personal")
```

## Safety Model

himalaya-mcp is designed so Claude cannot accidentally send email:

1. `draft_reply` generates a template but **never sends**
2. `send_email` without `confirm=true` returns a **preview only**
3. `send_email` with `confirm=true` is the only path to actually send
4. Plugin skills enforce showing the draft and waiting for explicit user approval
5. The email-assistant agent is instructed to never send without confirmation

No emails are ever deleted -- only flagged or moved.

## Diagnostics

```bash
himalaya-mcp doctor                    # Check all accounts (default)
himalaya-mcp doctor --account work     # Check only one account
himalaya-mcp doctor --fix              # Auto-fix common issues
himalaya-mcp doctor --json             # Machine-readable output
```

The `doctor` command checks prerequisites (Node.js, himalaya), MCP server health, per-account email connectivity, Claude Desktop extension state, Claude Code plugin registration (including installed-plugin and marketplace-source version drift vs the installed binary), and environment variables. See the [CLI Reference](../reference/cli.md#himalaya-mcp-doctor) for full details.

For in-conversation diagnostics, ask Claude to run a health check — that invokes the `health_check` MCP tool documented above.

## When something goes wrong

When an email tool fails, the structured error envelope tells Claude (and you) what went wrong and how to fix it. Each failure carries:

- `code` — stable identifier (e.g., `imap_auth_failed`, `transient`, `account_not_found`)
- `hint` — one-line suggested fix
- `account` — which account failed (in multi-account setups)
- `attempts` — how many times the operation was retried before surfacing

For the full failure-mode catalog and recovery steps, see the canonical [troubleshooting guide](troubleshooting.md).

## Testing

```bash
npm test    # 719 tests across 41 files (vitest, threads pool)
```

Test breakdown:

| File | Tests | What it covers |
|------|-------|----------------|
| `parser.test.ts` | 24 | JSON response parsing, formatEnvelope |
| `client.test.ts` | 47 | Subprocess wrapper, retry policy, argument building |
| `manage.test.ts` | 7 | flag_email, move_email client methods |
| `compose.test.ts` | 13 | draft_reply, send_email safety gate + attachment tests |
| `compose-new.test.ts` | 13 | compose_email safety gate + attachment tests |
| `folders.test.ts` | 13 | Folder tools (list, create, delete) |
| `attachments.test.ts` | 10 | Attachment list/download with body part filtering |
| `calendar.test.ts` | 21 | ICS parser + calendar event tools + escaping |
| `actions.test.ts` | 6 | export_to_markdown formatting |
| `threads.test.ts` | 30 | Thread parser + tool registration |
| `prompts.test.ts` | 23 | All 7 prompts register and return correct text |
| `config.test.ts` | 9 | Env var loading, template variable guards |
| `clipboard.test.ts` | 4 | pbcopy/xclip adapter |
| `errors.test.ts` | 21 | MCPError envelope + stderr classifier |
| `retry.test.ts` | 4 | Transient retry policy |
| `accounts.test.ts` | 13 | Multi-account discovery |
| `health.test.ts` | 8 | health_check tool |
| `trash.test.ts` | 5 | getTrashFolder |
| `unread.test.ts` | 4 | get_unread_count |
| `read-raw.test.ts` | 4 | read_email_raw |
| `render.test.ts` | 5 | render_email |
| `list-starred.test.ts` | 7 | list_starred |
| `reminders.test.ts` | 7 | create_reminder |
| `snooze.test.ts` | 10 | snooze_email, list_snoozed_emails |
| `inbox.test.ts` | 23 | search/list inbox tools |
| `config-toml.test.ts` | 15 | Himalaya config.toml parsing |
| `morning.test.ts` | 13 | morning_briefing + inbox_check prompts |
| `count-sync.test.ts` | 3 | Tool-count drift detection |
| `get-version.test.ts` | 3 | --version resolution (package.json + marketplace fallback) |
| `cli-version.test.ts` | 7 | himalaya CLI major-version detection |
| `cli-argv-smoke.test.ts` | 10 | Real fixture argv acceptance |
| `doctor-version.test.ts` | 10 | doctor version-drift checks |
| `check-prerequisites.test.ts` | 5 | doctor prerequisites checks |
| `vitest-config.test.ts` | 1 | Threads-pool default tripwire |
| `dogfood.test.ts` | 154 | Realistic Claude usage scenarios |
| `dogfood-reliability.test.ts` | 22 | Reliability scenarios |
| `setup.test.ts` | 51 | Setup CLI + multi-account doctor E2E |
| `e2e.test.ts` | 45 | Full MCP server pipeline + .mcpb build |
| `v150-features.test.ts` | 37 | v1.5.0 integration tests |
