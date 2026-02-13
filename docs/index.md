# himalaya-mcp

**Privacy-first email MCP server and Claude Code plugin wrapping the [himalaya](https://github.com/pimalaya/himalaya) CLI.**

---

## What is himalaya-mcp?

himalaya-mcp gives Claude the ability to read, triage, compose, and manage email -- all without sending your credentials to the cloud. It wraps the local himalaya CLI as a subprocess, exposing email operations through the [Model Context Protocol](https://modelcontextprotocol.io/).

## Key Features

<div class="grid cards" markdown>

- **11 MCP Tools** -- list, search, read, flag, move, draft reply, send, export, action items, clipboard
- **4 MCP Prompts** -- triage inbox, summarize email, daily digest, draft reply
- **3 MCP Resources** -- inbox listing, message by ID, folder list
- **Two-Phase Send** -- `send_email` returns a preview first; requires explicit `confirm=true` to actually send
- **Multi-Account** -- switch accounts per-call via `--account` parameter
- **Plugin + Server** -- use as a Claude Code plugin or standalone MCP server

</div>

## How It Works

```
Claude  <── MCP (JSON-RPC) ──>  himalaya-mcp  <── execFile ──>  himalaya CLI  <── IMAP/SMTP ──>  Mail Server
```

- All authentication stays local (himalaya handles IMAP/SMTP auth)
- No OAuth tokens leave your machine
- Subprocess uses `execFile` (no shell injection)
- Claude never sends email without your explicit confirmation

## Quick Start

```bash
# Prerequisites
brew install himalaya          # Email CLI
node --version                 # Node.js 22+

# Install
git clone https://github.com/Data-Wise/himalaya-mcp.git
cd himalaya-mcp
npm install && npm run build

# Use as Claude Code plugin
ln -s $(pwd) ~/.claude/plugins/himalaya-mcp
```

Then in Claude Code:

```
You: "Check my inbox"
You: "Triage my last 10 emails"
You: "Reply to the meeting email"
You: "Give me today's email digest"
```

## Next Steps

- [Installation](getting-started/installation.md) -- detailed setup guide
- [Quick Start](getting-started/quickstart.md) -- first email in 2 minutes
- [User Guide](guide/guide.md) -- complete tool and prompt reference
- [Workflows](guide/workflows.md) -- common email patterns
