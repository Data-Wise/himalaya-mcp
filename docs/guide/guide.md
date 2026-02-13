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

## Prerequisites

1. **Node.js 22+**
2. **himalaya CLI** -- `brew install himalaya`
3. **Configured email** -- at least one account in `~/.config/himalaya/config.toml`

Verify himalaya works:

```bash
himalaya --output json envelope list     # Should print JSON envelopes
```

## Installation

### As Claude Code Plugin (recommended)

```bash
cd ~/projects/dev-tools/himalaya-mcp
npm install && npm run build
ln -s ~/projects/dev-tools/himalaya-mcp ~/.claude/plugins/himalaya-mcp
```

Restart Claude Code. The plugin provides `/email:inbox`, `/email:triage`, `/email:digest`, and `/email:reply` skills.

### As Standalone MCP Server

Add to `~/.claude/settings.json` (or Claude Desktop config):

```json
{
  "mcpServers": {
    "himalaya": {
      "command": "node",
      "args": ["/path/to/himalaya-mcp/dist/index.js"]
    }
  }
}
```

## Configuration

All settings are optional. Set via environment variables in your MCP server config:

| Variable | Default | Description |
|----------|---------|-------------|
| `HIMALAYA_BINARY` | `himalaya` | Path to himalaya binary |
| `HIMALAYA_ACCOUNT` | (system default) | Default email account name |
| `HIMALAYA_FOLDER` | `INBOX` | Default folder for operations |
| `HIMALAYA_TIMEOUT` | `30000` | Command timeout in milliseconds |

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

## MCP Tools (11)

### Reading

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_emails` | List envelopes in a folder | `page_size`, `page`, `folder`, `account` |
| `search_emails` | Search by subject, from, body, etc. | `query`, `folder`, `account` |
| `read_email` | Read plain text body | `id`, `folder`, `account` |
| `read_email_html` | Read HTML body | `id`, `folder`, `account` |

### Managing

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `flag_email` | Add/remove flags (Seen, Flagged, Answered, etc.) | `id`, `flags`, `action` ("add"/"remove") |
| `move_email` | Move to another folder | `id`, `target_folder` |

### Composing

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `draft_reply` | Generate reply template (does NOT send) | `id`, `body`, `reply_all` |
| `send_email` | Send with safety gate | `template`, `confirm` (must be `true` to send) |

### Exporting

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `export_to_markdown` | Email to markdown with YAML frontmatter | `id`, `folder`, `account` |
| `create_action_item` | Extract todos, deadlines, commitments | `id`, `folder`, `account` |
| `copy_to_clipboard` | Copy text to system clipboard | `text` |

## MCP Prompts (4)

Prompts guide Claude's reasoning for email tasks. Use them via the MCP prompt interface or through the plugin skills.

| Prompt | Purpose | Parameters |
|--------|---------|------------|
| `triage_inbox` | Classify emails as actionable/FYI/skip, suggest flags and moves | `count` (default: 10) |
| `summarize_email` | One-sentence summary + action items + priority | `id`, `folder` |
| `daily_email_digest` | Markdown digest grouped by priority (action/FYI/low) | (none) |
| `draft_reply` | Compose a reply with tone guidance and safety reminders | `id`, `tone`, `instructions` |

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

## Testing

```bash
npm test    # 65 tests across 10 files (vitest)
```

Test breakdown:

| File | Tests | What it covers |
|------|-------|----------------|
| `parser.test.ts` | 13 | JSON response parsing, formatEnvelope |
| `client.test.ts` | 12 | Subprocess wrapper, argument building |
| `manage.test.ts` | 7 | flag_email, move_email client methods |
| `compose.test.ts` | 9 | draft_reply, send_email safety gate |
| `actions.test.ts` | 6 | export_to_markdown formatting |
| `prompts.test.ts` | 15 | All 4 prompts register and return correct text |
| `config.test.ts` | 7 | Env var loading, edge cases |
| `clipboard.test.ts` | 4 | pbcopy/xclip adapter |
| `dogfood.test.ts` | 29 | Realistic Claude usage scenarios |
| `e2e.test.ts` | 20 | Full MCP server pipeline with fake himalaya |
