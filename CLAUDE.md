# CLAUDE.md

## Project Overview

**himalaya-mcp** — Privacy-first email MCP server and Claude Code plugin wrapping the himalaya CLI.

- **Architecture:** TypeScript MCP server + Claude Code plugin
- **Backend:** himalaya CLI (subprocess with JSON output)
- **Platforms:** Claude Code (plugin), Claude Desktop/Cowork (MCP server)
- **Current Phase:** 0 — Setup & Specs (no implementation yet)

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
│   │   ├── client.ts            # Subprocess wrapper
│   │   ├── parser.ts            # JSON response parser
│   │   └── types.ts             # TypeScript types
│   ├── tools/
│   │   ├── inbox.ts             # list_emails, search_emails
│   │   ├── read.ts              # read_email, read_email_html
│   │   ├── compose.ts           # draft_reply, send_email
│   │   ├── manage.ts            # flag_email, move_email
│   │   └── actions.ts           # export_to_markdown, create_action_item
│   ├── resources/
│   │   ├── inbox.ts             # email://inbox
│   │   ├── message.ts           # email://message/{id}
│   │   └── folders.ts           # email://folders
│   ├── prompts/
│   │   ├── triage.ts            # triage_inbox prompt
│   │   ├── summarize.ts         # summarize_email prompt
│   │   ├── draft.ts             # draft_reply prompt
│   │   └── digest.ts            # daily_email_digest prompt
│   ├── adapters/
│   │   ├── markdown.ts          # Export to .md
│   │   ├── clipboard.ts         # pbcopy
│   │   ├── obsidian.ts          # Obsidian vault (future)
│   │   └── apple.ts             # Apple Notes/Reminders (future)
│   └── config.ts                # User configuration
├── plugin/
│   ├── skills/                  # Claude Code plugin skills
│   ├── agents/                  # Plugin agents
│   └── hooks/                   # Plugin hooks
├── docs/specs/                  # Design specs
├── tests/                       # Test files
├── plugin.json                  # Claude Code plugin manifest
├── package.json
├── tsconfig.json
└── manifest.json                # MCPB manifest (for Claude Desktop, future)
```

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
npm test                         # Run vitest
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
| 0. Setup & Specs | Repo, structure, specs | Current |
| 1. Core Read (MVP) | list, search, read tools + resources | Pending |
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
