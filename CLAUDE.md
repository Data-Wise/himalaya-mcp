# CLAUDE.md

## Project Overview

**himalaya-mcp** — Privacy-first email MCP server and Claude Code plugin wrapping the himalaya CLI.

- **Architecture:** TypeScript MCP server + Claude Code plugin
- **Backend:** himalaya CLI (subprocess with JSON output)
- **Platforms:** Claude Code (plugin), Claude Desktop/Cowork (MCP server)
- **Current Phase:** 5 — All phases complete (11 tools, 4 prompts, 3 resources, 160 tests)

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
│   ├── config.ts                # Env-based configuration (HIMALAYA_BINARY, etc.)
│   ├── himalaya/
│   │   ├── client.ts            # Subprocess wrapper (execFile, no shell injection)
│   │   ├── parser.ts            # JSON response parser + formatEnvelope helper
│   │   └── types.ts             # TypeScript types (Envelope, Folder, params, etc.)
│   ├── tools/
│   │   ├── inbox.ts             # list_emails, search_emails
│   │   ├── read.ts              # read_email, read_email_html
│   │   ├── manage.ts            # flag_email, move_email
│   │   ├── compose.ts           # draft_reply, send_email (two-phase safety gate)
│   │   └── actions.ts           # export_to_markdown, create_action_item
│   ├── prompts/
│   │   ├── triage.ts            # triage_inbox prompt
│   │   ├── summarize.ts         # summarize_email prompt
│   │   ├── digest.ts            # daily_email_digest prompt
│   │   └── reply.ts             # draft_reply prompt
│   ├── resources/
│   │   └── index.ts             # email://inbox, email://message/{id}, email://folders
│   └── adapters/
│       └── clipboard.ts         # copy_to_clipboard (pbcopy/xclip)
├── plugin/
│   ├── skills/                  # Claude Code plugin skills (inbox, triage, digest, reply)
│   ├── agents/                  # Plugin agents (email-assistant)
│   └── hooks/                   # Plugin hooks
├── .claude-plugin/
│   └── plugin.json              # Claude Code plugin manifest
├── .mcp.json                    # MCP server config (uses ${CLAUDE_PLUGIN_ROOT})
├── docs/
│   ├── guide.md                 # User guide (setup, tools, prompts, resources)
│   ├── REFCARD.md               # Quick reference card
│   ├── workflows.md             # Common email workflow patterns
│   ├── architecture.md          # System design, module map, data flow
│   └── specs/                   # Design specs
├── tests/
│   ├── parser.test.ts           # 13 parser tests
│   ├── client.test.ts           # 12 client tests (subprocess mock)
│   ├── manage.test.ts           # 7 manage tools tests
│   ├── compose.test.ts          # 9 compose tools tests
│   ├── actions.test.ts          # 6 export/action tests
│   ├── prompts.test.ts          # 15 prompt registration tests
│   ├── config.test.ts           # 7 config tests
│   ├── clipboard.test.ts        # 4 clipboard tests
│   ├── dogfood.test.ts          # 29 dogfooding tests (realistic Claude usage)
│   └── e2e.test.ts              # 20 E2E tests (headless MCP server pipeline)
├── package.json
└── tsconfig.json
```

### Implemented MCP Tools (11)

| Tool | Description |
|------|-------------|
| `list_emails` | List envelopes in a folder (paginated, multi-account) |
| `search_emails` | Search via himalaya filter syntax (subject, from, body, etc.) |
| `read_email` | Read message body (plain text) |
| `read_email_html` | Read message body (HTML) |
| `flag_email` | Add/remove flags (Seen, Flagged, Answered, etc.) |
| `move_email` | Move email to target folder |
| `draft_reply` | Generate reply template with DRAFT markers |
| `send_email` | Send email with two-phase safety gate (preview then confirm) |
| `export_to_markdown` | Convert email to markdown with YAML frontmatter |
| `create_action_item` | Extract action items and context from email |
| `copy_to_clipboard` | Copy text to system clipboard (pbcopy/xclip) |

### Implemented MCP Prompts (4)

| Prompt | Description |
|--------|-------------|
| `triage_inbox` | Guide Claude to classify emails as actionable/FYI/skip |
| `summarize_email` | One-sentence summary + action items |
| `daily_email_digest` | Markdown digest grouped by priority |
| `draft_reply` | Reply composition with tone/safety guidance |

### Implemented MCP Resources (3)

| Resource | URI |
|----------|-----|
| Inbox listing | `email://inbox` |
| Message by ID | `email://message/{id}` |
| Folder list | `email://folders` |

---

## Git Workflow

```text
main (protected) ← PR only, never direct commits
  ↑
dev (integration) ← Plan here, branch from here
  ↑
feature/* (worktrees) ← All implementation work
```

### Workflow Steps

| Step | Action | Command |
|------|--------|---------|
| 1. Plan | Analyze on `dev`, wait for approval | `git checkout dev` |
| 2. Branch | Create worktree for isolation | `/craft:git:worktree feature/<name>` |
| 3. Develop | Conventional commits (`feat:`, `fix:`, etc.) | Small, atomic commits |
| 4. Integrate | Test → rebase → PR to dev | `gh pr create --base dev` |
| 5. Release | PR from dev to main | `gh pr create --base main --head dev` |

### Constraints

- **CRITICAL**: Always start work from `dev` branch
- **Never** commit directly to `main`
- **Never** write feature code on `dev`
- **Always** verify branch: `git branch --show-current`

### Branch Protection

| Branch | Code Files | .md Files | Git Operations |
|--------|-----------|-----------|----------------|
| `main` | BLOCKED | BLOCKED | Commit/push BLOCKED |
| `dev` | New: BLOCKED, Existing: allowed | ALLOWED | Commit/push allowed |
| `feature/*` | ALLOWED | ALLOWED | All allowed |

### Quick Reference

| Action | Command |
|--------|---------|
| Create worktree | `git worktree add ~/.git-worktrees/himalaya-mcp/feature-<name> -b feature/<name> dev` |
| List worktrees | `git worktree list` |
| Create PR | `gh pr create --base dev` |
| Release | `gh pr create --base main --head dev` |
| Clean merged | `git worktree remove <path> && git branch -d feature/<name>` |

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
npm test                         # Run vitest (160 tests across 11 test files)
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
| 2. Triage + Export | flag, move, export_to_markdown, MCP prompts | Done |
| 3. Compose + Actions | draft_reply, send_email (safety gate), create_action_item | Done |
| 4. Clipboard + Config | copy_to_clipboard adapter, env-based config | Done |
| 5. Plugin Skills | /email:* skills, agent updates, reply skill | Done |

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

**Last Updated:** 2026-02-14
