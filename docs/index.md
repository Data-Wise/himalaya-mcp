# himalaya-mcp

**Privacy-first email MCP server and Claude Code plugin wrapping the [himalaya](https://github.com/pimalaya/himalaya) CLI.**

---

## What is himalaya-mcp?

himalaya-mcp gives Claude the ability to read, triage, compose, and manage email -- all without sending your credentials to the cloud. It wraps the local himalaya CLI as a subprocess, exposing email operations through the [Model Context Protocol](https://modelcontextprotocol.io/).

## Key Features

<div class="grid cards" markdown>

- :envelope: **11 MCP Tools**

    ---

    List, search, read, flag, move, draft reply, send, export, action items, clipboard

    [:octicons-arrow-right-24: Command Reference](reference/commands.md)

- :brain: **4 MCP Prompts**

    ---

    Triage inbox, summarize email, daily digest, draft reply

    [:octicons-arrow-right-24: Prompt Details](reference/commands.md#prompts)

- :lock: **Two-Phase Send**

    ---

    `send_email` returns a preview first; requires explicit `confirm=true`

    [:octicons-arrow-right-24: Safety Model](guide/guide.md#safety-model)

- :people_holding_hands: **Multi-Account**

    ---

    Switch accounts per-call via `account` parameter

    [:octicons-arrow-right-24: Multi-Account Guide](guide/workflows.md#6-multi-account-workflow)

- :electric_plug: **Plugin + Server**

    ---

    Use as a Claude Code plugin (5 skills) or standalone MCP server

    [:octicons-arrow-right-24: Installation](getting-started/installation.md)

- :shield: **Privacy-First**

    ---

    All authentication stays local. No OAuth tokens leave your machine.

    [:octicons-arrow-right-24: Architecture](reference/architecture.md)

</div>

## How It Works

```mermaid
flowchart LR
    A["`**Claude**
    Code / Desktop`"] -->|MCP JSON-RPC| B["`**himalaya-mcp**
    11 tools · 4 prompts`"]
    B -->|execFile| C["`**himalaya CLI**
    --output json`"]
    C -->|IMAP/SMTP| D["`**Mail Server**
    Gmail, Fastmail, etc.`"]
```

- All authentication stays local (himalaya handles IMAP/SMTP auth)
- No OAuth tokens leave your machine
- Subprocess uses `execFile` (no shell injection)
- Claude never sends email without your explicit confirmation

## Plugin Skills

When installed as a Claude Code plugin, these slash commands are available:

| Skill | Description |
|-------|-------------|
| `/email:inbox` | Check inbox, list recent emails |
| `/email:triage` | AI-powered email classification |
| `/email:digest` | Generate daily priority digest |
| `/email:reply` | Draft and send with safety gate |
| `/email:help` | Help hub -- browse all tools, prompts, workflows |

## Quick Start

### Homebrew (recommended)

```bash
brew tap data-wise/tap
brew install himalaya-mcp
```

That's it. Homebrew installs himalaya CLI + Node.js, bundles the server, symlinks the plugin, and auto-enables it in Claude Code.

### Claude Code Plugin (from GitHub)

```bash
claude plugin marketplace add Data-Wise/himalaya-mcp
claude plugin install himalaya-mcp
```

### From Source

```bash
brew install himalaya          # Email CLI
git clone https://github.com/Data-Wise/himalaya-mcp.git
cd himalaya-mcp
npm install && npm run build
ln -s $(pwd) ~/.claude/plugins/himalaya-mcp
```

### Claude Desktop

```bash
himalaya-mcp setup             # Auto-configure MCP server
```

Then in Claude Code:

```
You: "Check my inbox"
You: "Triage my last 10 emails"
You: "Reply to the meeting email"
You: "Give me today's email digest"
You: "/email:help"
```

## Next Steps

- **[Installation](getting-started/installation.md)** -- detailed setup guide
- **[Quick Start](getting-started/quickstart.md)** -- first email in 2 minutes
- **[Tutorials](tutorials/index.md)** -- step-by-step from beginner to automation
- **[Command Reference](reference/commands.md)** -- all tools, prompts, and resources
- **[User Guide](guide/guide.md)** -- complete walkthrough
- **[Workflows](guide/workflows.md)** -- common email patterns
- **[Quick Reference](reference/refcard.md)** -- one-page cheat sheet
- **[Architecture](reference/architecture.md)** -- system design and security
