# Using himalaya-mcp in Claude Desktop

Use himalaya-mcp as a Desktop Extension to read, triage, and manage email directly in Claude Desktop and Claude Cowork.

## What You'll Learn

- Install the `.mcpb` Desktop Extension
- Configure your himalaya binary path and account
- Use email tools via natural language
- Diagnose and fix common issues

## Prerequisites

- Claude Desktop installed
- himalaya CLI installed and configured (`brew install himalaya`)
- At least one email account in `~/.config/himalaya/config.toml`

Verify himalaya works from your terminal first:

```bash
himalaya envelope list --output json
```

## Step 1: Install the Extension

### Option A: Double-click (easiest)

Download `himalaya-mcp-v{version}.mcpb` from [GitHub Releases](https://github.com/Data-Wise/himalaya-mcp/releases) and double-click the file. Claude Desktop opens and installs it automatically.

### Option B: CLI install

If you have himalaya-mcp installed locally (Homebrew or source):

```bash
himalaya-mcp install-ext
```

This unpacks the extension and registers it with Claude Desktop.

### Option C: Build from source

```bash
git clone https://github.com/Data-Wise/himalaya-mcp.git
cd himalaya-mcp
npm install
npm run build:mcpb          # Creates himalaya-mcp-v{version}.mcpb
himalaya-mcp install-ext    # Install into Claude Desktop
```

## Step 2: Configure (first time only)

When the extension installs, Claude Desktop shows three optional configuration fields:

| Field | What to set | When to set it |
|-------|-------------|----------------|
| **himalaya binary path** | `/opt/homebrew/bin/himalaya` | Always recommended (Desktop doesn't inherit your shell PATH) |
| **Default account** | Your account name (e.g., `personal`) | Only if you have multiple accounts |
| **Default folder** | Leave empty | Only if you want a non-INBOX default |

**Important:** Set the binary path. Claude Desktop runs in its own environment without your shell's PATH, so it can't find `himalaya` unless you provide the full path.

Find your himalaya path:

```bash
which himalaya
# /opt/homebrew/bin/himalaya
```

### Editing settings later

Extension settings are stored at:

```
~/Library/Application Support/Claude/Claude Extensions Settings/himalaya-mcp.json
```

```json
{
  "isEnabled": true,
  "userConfig": {
    "himalaya_binary": "/opt/homebrew/bin/himalaya",
    "himalaya_account": "",
    "himalaya_folder": ""
  }
}
```

Edit this file directly and restart Claude Desktop to apply changes.

## Step 3: Restart Claude Desktop

After installing or updating the extension, restart Claude Desktop. The extension registers 19 tools, 4 prompts, and 3 resources.

## Step 4: Try It

Open a new conversation in Claude Desktop and type naturally:

### Read emails

```
You: "Check my inbox"
```

Claude calls `list_emails` and shows your recent messages with ID, sender, subject, date, and flags.

```
You: "Read email 42"
```

Claude calls `read_email` to show the full message body.

### Search

```
You: "Find emails from Alice about the budget"
```

Claude calls `search_emails(query: "from alice and subject budget")`.

### Triage

```
You: "Triage my last 10 emails"
```

Claude uses the `triage_inbox` prompt to classify each email as Actionable, FYI, or Skip, then suggests flags and folder moves.

### Reply

```
You: "Reply to email 42 saying I'll be there"
```

Claude generates a draft reply and shows it for your approval. It **never sends** until you explicitly confirm.

### Daily digest

```
You: "Give me today's email digest"
```

Claude uses the `daily_email_digest` prompt to create a priority-grouped summary.

### Multi-account

```
You: "List emails from my work account"
```

Claude calls `list_emails(account: "work")`. Every tool accepts an optional `account` parameter.

### Attachments and calendar

```
You: "What attachments does email 88 have?"
You: "Download the PDF from email 88"
You: "Extract the calendar invite from email 90"
```

### Compose

```
You: "Send Alice an email about the meeting tomorrow"
```

Claude composes a preview first -- you review and approve before it sends.

## Step 5: Verify with Doctor

If something isn't working, run the diagnostic command:

```bash
himalaya-mcp doctor
```

This checks all six layers: prerequisites, MCP server, email connectivity, Desktop extension install, Claude Code plugin, and environment variables.

```bash
himalaya-mcp doctor --fix    # Auto-fix common issues
```

## Claude Cowork

The extension works identically in Claude Cowork (the collaborative mode within Claude Desktop). Cowork shares the same extension registry and settings -- no additional configuration needed.

## Differences from Claude Code

| Feature | Claude Desktop | Claude Code |
|---------|---------------|-------------|
| 19 MCP tools | Yes | Yes |
| 4 MCP prompts | Yes | Yes |
| 3 MCP resources | Yes | Yes |
| Interaction style | Natural language | Natural language + `/email:*` skills |
| Email assistant agent | No | Yes |
| Slash commands | No | 7 skills (`/email:inbox`, etc.) |

In Claude Desktop, everything is natural language. Say "check my inbox" instead of `/email:inbox`. The underlying tools are identical.

## Troubleshooting

### "himalaya CLI not found"

The most common issue. Claude Desktop doesn't inherit your shell PATH.

**Fix:** Set the full path in extension settings:

```json
{
  "userConfig": {
    "himalaya_binary": "/opt/homebrew/bin/himalaya"
  }
}
```

Or run `himalaya-mcp doctor --fix` to set it automatically.

### Tools not appearing

1. Restart Claude Desktop after installing the extension
2. Check that the extension is enabled (look for the extensions icon in Desktop)
3. Run `himalaya-mcp doctor` to verify the extension registry

### Slow responses

Large mailboxes or slow IMAP servers can take time. The default timeout is 2 minutes (120s). For very large mailboxes, you can increase it or set to 0 for unlimited:

```json
{
  "userConfig": {
    "himalaya_binary": "/opt/homebrew/bin/himalaya"
  }
}
```

And set `HIMALAYA_TIMEOUT` in the manifest env (requires rebuilding the `.mcpb`).

## Next Steps

- [Command Reference](../reference/commands.md) -- all 19 tools with parameters and examples
- [Workflows](../guide/workflows.md) -- common email patterns (triage, reply, export)
- [Troubleshooting](../guide/troubleshooting.md) -- full troubleshooting guide
- [Desktop Extensions Reference](../reference/desktop-extensions.md) -- `.mcpb` format details
