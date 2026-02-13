# SPEC: himalaya-mcp

**Status:** draft
**Created:** 2026-02-13
**From Brainstorm:** ~/BRAINSTORM-himalaya-mcp-2026-02-13.md

---

## Overview

Privacy-first email MCP server + Claude Code plugin wrapping the himalaya CLI. Provides email read/triage/compose/export capabilities to Claude via MCP tools, resources, and prompts. Subprocess-based architecture (`himalaya --output json`) for zero additional dependencies.

## Primary User Story

**As a** developer using Claude Code,
**I want** Claude to read, search, triage, and export my emails,
**So that** I can manage email without leaving my terminal workflow.

## Acceptance Criteria

- [ ] `list_emails` tool returns envelope list from himalaya (JSON parsed)
- [ ] `read_email` tool returns full email body (plain text)
- [ ] `search_emails` tool passes IMAP query to himalaya
- [ ] `list_folders` tool returns available mail folders
- [ ] `email://inbox` resource exposes inbox as browsable content
- [ ] `email://message/{id}` resource exposes individual emails
- [ ] Plugin installable via Claude Code plugin system
- [ ] Works with existing himalaya auth (app passwords, oauth2-proxy)

## Secondary User Stories

- **As a** Claude Desktop (Cowork) user, I want email access via MCP connector
- **As a** user with multiple accounts, I want to switch accounts via tool parameter
- **As a** privacy-conscious user, I want all email processing local (no cloud tokens)

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│ Claude Desktop (Cowork)  │  Claude Code (CLI)        │
├─────────────────────────────────────────────────────┤
│              himalaya-mcp (MCP server)               │
│    Tools + Resources + Prompts + Adapters            │
├─────────────────────────────────────────────────────┤
│         himalaya CLI (subprocess)                    │
│         IMAP/SMTP + local auth                       │
├─────────────────────────────────────────────────────┤
│         Email provider (Exchange/Gmail/etc.)          │
└─────────────────────────────────────────────────────┘
```

### Component Diagram

```
himalaya-mcp/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── himalaya/
│   │   ├── client.ts         # Subprocess wrapper
│   │   ├── parser.ts         # JSON response parser
│   │   └── types.ts          # TypeScript types
│   ├── tools/                # MCP tool handlers
│   │   ├── inbox.ts          # list_emails, search_emails
│   │   ├── read.ts           # read_email, read_email_html
│   │   ├── compose.ts        # draft_reply, send_email
│   │   ├── manage.ts         # flag_email, move_email
│   │   ├── triage.ts         # classify, summarize (prompt-based)
│   │   └── actions.ts        # create_todo, create_meeting
│   ├── resources/            # MCP resource providers
│   │   ├── inbox.ts          # email://inbox
│   │   ├── message.ts        # email://message/{id}
│   │   └── folders.ts        # email://folders
│   ├── prompts/              # MCP prompt templates
│   │   ├── triage.ts         # triage_inbox
│   │   ├── summarize.ts      # summarize_email
│   │   ├── reply.ts          # draft_reply
│   │   └── digest.ts         # daily_email_digest
│   ├── adapters/             # Output adapters
│   │   ├── markdown.ts       # Export to .md
│   │   ├── clipboard.ts      # pbcopy (macOS)
│   │   ├── obsidian.ts       # Obsidian vault (future)
│   │   └── apple.ts          # Apple Notes/Reminders (future)
│   └── config.ts             # User configuration
├── plugin/                   # Claude Code plugin layer
│   ├── skills/               # Slash command skills
│   ├── agents/               # Autonomous agents
│   └── hooks/                # Lifecycle hooks
└── tests/                    # Test suites
```

## API Design

### MCP Tools (Phase 1-3)

| Tool | Description | himalaya Command | Phase |
|------|-------------|------------------|-------|
| `list_emails` | List recent emails (paginated) | `himalaya envelope list --output json` | 1 |
| `search_emails` | Search by IMAP query | `himalaya envelope list --query "..." --output json` | 1 |
| `read_email` | Read full email body (plain text) | `himalaya message read {id}` | 1 |
| `list_folders` | List mail folders | `himalaya folder list --output json` | 1 |
| `read_email_html` | Read HTML version | `himalaya message read --html {id}` | 3 |
| `flag_email` | Add/remove flags | `himalaya flag add/remove {id} {flag}` | 2 |
| `move_email` | Move to folder | `himalaya message move {id} {folder}` | 3 |
| `draft_reply` | Generate reply draft | `himalaya message reply --template {id}` | 3 |
| `send_email` | Send email (REQUIRES confirmation) | `himalaya message send < draft` | 3 |
| `export_to_markdown` | Save email + summary to .md | Custom: read + format + write | 2 |
| `create_action_item` | Extract action/todo from email | Custom: read + parse + export | 3 |

### MCP Resources

| URI Pattern | Description | Phase |
|-------------|-------------|-------|
| `email://inbox` | Current inbox listing | 1 |
| `email://message/{id}` | Individual email content | 1 |
| `email://folders` | Available mail folders | 1 |

### MCP Prompts

| Prompt | Description | Phase |
|--------|-------------|-------|
| `triage_inbox` | Classify each email as actionable/skip | 2 |
| `summarize_email` | Summarize email in one sentence | 2 |
| `draft_reply` | Draft professional reply | 3 |
| `daily_email_digest` | Create markdown digest of important emails | 2 |

## Data Models

### Envelope (from himalaya JSON)

```typescript
interface Envelope {
  id: number;
  from: { name?: string; addr: string };
  subject: string;
  date: string;
  flags: string[];
}
```

### Message

```typescript
interface Message {
  id: number;
  envelope: Envelope;
  body: string;
  html?: string;
}
```

## Dependencies

| Package | Purpose | Phase |
|---------|---------|-------|
| `@modelcontextprotocol/sdk` | MCP server framework | 1 |
| `typescript` | Language | 1 |
| `vitest` | Testing | 1 |
| himalaya CLI (system) | Email backend | 1 |

## UI/UX Specifications

N/A - CLI/MCP server only. No GUI components.

### Plugin Skills (Claude Code)

| Skill | Trigger | Description |
|-------|---------|-------------|
| `/email:inbox` | "check email", "inbox" | List and summarize recent emails |
| `/email:triage` | "triage email" | AI-classify inbox emails |
| `/email:digest` | "email digest" | Generate daily email summary |

## Implementation Phases

### Phase 1: Core Read (MVP) - 1 weekend
- himalaya subprocess wrapper (spawn, parse JSON, errors)
- `list_emails`, `read_email`, `search_emails`, `list_folders` tools
- `email://inbox`, `email://message/{id}` resources
- Test in Claude Code via settings.json MCP config

### Phase 2: Triage + Export - 1 week
- `triage_inbox`, `summarize_email` prompts
- `flag_email` tool
- `export_to_markdown` tool + clipboard adapter
- `daily_email_digest` prompt

### Phase 3: Compose + Actions - 1-2 weeks
- `draft_reply`, `send_email` (with safety gate), `move_email` tools
- `create_action_item` tool
- `read_email_html` tool

### Phase 4: Adapters + Distribution - 2 weeks
- Obsidian, Apple Notes/Reminders/Calendar adapters
- MCPB packaging for Claude Desktop
- User config, README, docs

### Phase 5: Claude Code Plugin - 1 week
- Plugin manifest, skills, agent, hooks
- `/email:inbox`, `/email:triage`, `/email:digest` skills

## Open Questions

1. **himalaya in Cowork VM?** Cowork runs in Linux VM. himalaya needs install inside VM, or MCP server runs on host.
2. **Rate limiting?** Cache envelope lists to avoid hammering IMAP?
3. **Attachments?** Expose attachment download as tool?
4. **Multi-account?** How to expose account switching in MCP?

## Design Decisions

### 1. Subprocess over Library
himalaya CLI's `--output json` makes parsing trivial. Zero additional deps. Can optimize to FFI later if needed.

### 2. Multi-layer Send Confirmation
`send_email` returns `{ status: "pending_confirmation", preview: "..." }` -> Claude shows preview -> user confirms -> tool executes send.

### 3. Both Tools and Resources
Tools for explicit actions with parameters, resources for browsing/context. Resources better for Cowork, tools better for Claude Code.

### 4. Prompt-based AI Triage
Don't embed AI in MCP server. Provide MCP prompts that tell Claude HOW to triage. Claude IS the AI.

## Review Checklist

- [ ] All Phase 1 tools implemented and tested
- [ ] himalaya subprocess error handling (not found, auth failure, timeout)
- [ ] JSON parsing handles all himalaya output formats
- [ ] Resources return proper MCP resource format
- [ ] Plugin.json valid and installable
- [ ] Skills trigger correctly
- [ ] send_email safety gate verified
- [ ] Works with both Claude Code and Claude Desktop

## Implementation Notes

- Start with Phase 1 (read-only) — safe, immediately useful
- Use `child_process.execFile` (not `exec`) for subprocess — avoids shell injection
- himalaya must be in PATH or configured via `config.ts`
- All tool responses should include `_meta` field with timing info
- Test with real IMAP account (DT's Exchange setup via himalaya)

## History

| Date | Change |
|------|--------|
| 2026-02-13 | Initial spec from brainstorm session |
