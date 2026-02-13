# CLAUDE.md

## Project Overview

**himalaya-mcp** — Privacy-first email MCP server and Claude Code plugin wrapping the himalaya CLI.

- **Architecture:** TypeScript MCP server + Claude Code plugin
- **Backend:** himalaya CLI (subprocess with JSON output)
- **Platforms:** Claude Code (plugin), Claude Desktop/Cowork (MCP server)
- **Current Phase:** 1 — Core Read (MVP complete)

### What It Does

Exposes email operations as MCP tools, resources, and prompts so Claude can:
- List, search, and read emails (tools + resources)
- Triage inbox: classify, summarize, flag (prompts + tools)
- Compose and send with safety gates (tools)
- Export to markdown, clipboard, Obsidian, Apple ecosystem (adapters)

### Why himalaya

- Local auth (no OAuth tokens sent to cloud)
- Multi-account IMAP/SMTP support
- `--output json` mode for trivial parsing
- Already in the developer's stack (`em` dispatcher in flow-cli)

---

## Project Structure

```
himalaya-mcp/
├── src/
│   ├── index.ts                 # MCP server entry point
│   ├── himalaya/
│   │   ├── client.ts            # Subprocess wrapper (execFile, no shell injection)
│   │   ├── parser.ts            # JSON response parser + formatEnvelope helper
│   │   └── types.ts             # TypeScript types (Envelope, Folder, Account, etc.)
│   ├── tools/
│   │   ├── inbox.ts             # list_emails, search_emails
│   │   └── read.ts              # read_email, read_email_html
│   └── resources/
│       └── index.ts             # email://inbox, email://message/{id}, email://folders
├── plugin/
│   ├── skills/                  # Claude Code plugin skills (inbox, triage, digest)
│   ├── agents/                  # Plugin agents (email-assistant)
│   └── hooks/                   # Plugin hooks
├── .claude-plugin/
│   └── plugin.json              # Claude Code plugin manifest
├── .mcp.json                    # MCP server config (uses ${CLAUDE_PLUGIN_ROOT})
├── docs/specs/                  # Design specs
├── tests/
│   ├── parser.test.ts           # 13 parser tests
│   ├── client.test.ts           # 12 client tests (subprocess mock)
│   ├── dogfood.test.ts          # 14 dogfooding tests (realistic Claude usage)
│   └── e2e.mjs                  # 11 e2e tests (live himalaya CLI)
├── package.json
└── tsconfig.json
```

### Implemented MCP Tools

| Tool | Description |
|------|-------------|
| `list_emails` | List envelopes in a folder (paginated, multi-account) |
| `search_emails` | Search via himalaya filter syntax (subject, from, body, etc.) |
| `read_email` | Read message body (plain text) |
| `read_email_html` | Read message body (HTML) |

### Implemented MCP Resources

| Resource | URI |
|----------|-----|
| Inbox listing | `email://inbox` |
| Message by ID | `email://message/{id}` |
| Folder list | `email://folders` |

---

## Development

### Prerequisites

- Node.js 22+ (or Bun)
- himalaya CLI (`brew install himalaya`)
- TypeScript 5.7+

### Setup

```bash
npm install
npm run build
```

### Testing

```bash
npm test                         # Run vitest (39 unit/integration tests)
npm run test:e2e                 # E2E tests against live himalaya CLI
node dist/index.js               # Run MCP server directly
```

### Adding to Claude Code

```json
// ~/.claude/settings.json
{
  "mcpServers": {
    "himalaya": {
      "command": "node",
      "args": ["/Users/dt/projects/dev-tools/himalaya-mcp/dist/index.js"]
    }
  }
}
```

Or symlink as plugin:
```bash
ln -s ~/projects/dev-tools/himalaya-mcp ~/.claude/plugins/himalaya-mcp
```

---

## Implementation Phases

| Phase | Scope | Status |
|-------|-------|--------|
| 0. Setup & Specs | Repo, structure, specs | Done |
| 1. Core Read (MVP) | list, search, read tools + resources | Done |
| 2. Triage + Export | classify, summarize, flag, markdown export | Pending |
| 3. Compose + Actions | reply, send (with safety), action extraction | Pending |
| 4. Adapters | Obsidian, Apple, clipboard, MCPB packaging | Pending |
| 5. Plugin Skills | /email:* skills, agents, hooks | Pending |

---

## Design Decisions

1. **Subprocess over library** — Wrap himalaya CLI, don't reimplement IMAP
2. **Prompt-based triage** — Claude IS the AI; MCP prompts guide it, no embedded AI
3. **Safety gates** — send_email returns preview, requires explicit confirmation
4. **Tools + Resources** — Tools for actions, resources for browsing
5. **Plugin-first** — Claude Code plugin bundles MCP server; extract for Desktop later

---

## Relationship to flow-cli

himalaya-mcp does NOT replace the `em` dispatcher. They serve different contexts:
- `em` = terminal-native, fzf picker, interactive ZSH workflow
- himalaya-mcp = AI-native, Claude as the interface, MCP protocol

Both wrap the same himalaya CLI and can coexist.

---

**Last Updated:** 2026-02-13
