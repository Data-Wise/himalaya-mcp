# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ Claude (Code / Desktop / Cowork)                                │
│                                                                 │
│   "Triage my inbox"                                             │
│         │                                                       │
│         ▼                                                       │
│   ┌─────────────┐   MCP Protocol   ┌──────────────────────┐    │
│   │ MCP Client  │◄────────────────►│ himalaya-mcp         │    │
│   └─────────────┘   (JSON-RPC)     │                      │    │
│                                     │  Tools (11)          │    │
│                                     │  Prompts (4)         │    │
│                                     │  Resources (3)       │    │
│                                     └──────────┬───────────┘    │
│                                                │                │
│                                     execFile (no shell)         │
│                                                │                │
│                                     ┌──────────▼───────────┐    │
│                                     │ himalaya CLI         │    │
│                                     │ --output json        │    │
│                                     └──────────┬───────────┘    │
│                                                │                │
└────────────────────────────────────────────────┼────────────────┘
                                                 │
                                      IMAP / SMTP (local auth)
                                                 │
                                      ┌──────────▼───────────┐
                                      │ Mail Server          │
                                      │ (Gmail, Fastmail,    │
                                      │  self-hosted, etc.)  │
                                      └──────────────────────┘
```

## Distribution Architecture

```
Homebrew (Primary)                  GitHub (Fallback)
  brew install himalaya-mcp           claude plugin marketplace add Data-Wise/himalaya-mcp
  │                                   claude plugin install himalaya-mcp
  ├─ depends_on "himalaya"            │
  ├─ depends_on "node"                └─ Copies plugin to cache, uses ${CLAUDE_PLUGIN_ROOT}
  │
  ├─ libexec/
  │   ├─ .claude-plugin/plugin.json
  │   ├─ .claude-plugin/marketplace.json
  │   ├─ .mcp.json
  │   ├─ plugin/skills/*.md
  │   ├─ plugin/agents/*.md
  │   └─ dist/index.js (esbuild bundle, 583KB)
  │
  └─ post_install → himalaya-mcp-install
      ├─ symlink → ~/.claude/plugins/himalaya-mcp
      ├─ register → ~/.claude/local-marketplace/marketplace.json
      └─ auto-enable → ~/.claude/settings.json
```

### Build Pipeline

```
src/index.ts (16 files)
  │
  ├─ npm run build          → dist/*.js + .d.ts (development)
  │
  └─ npm run build:bundle   → dist/index.js (583KB, production)
      esbuild --bundle --platform=node --target=node22 --format=esm --minify
      Inlines: @modelcontextprotocol/sdk, zod, content-type, raw-body
```

### CI/CD Workflows

```
.github/workflows/
├── ci.yml                 Push/PR to main|dev — lint, typecheck, build, test, bundle, validate plugin
├── docs.yml               Push to main — deploy GitHub Pages
└── homebrew-release.yml   Release published — validate → compute SHA → update homebrew-tap formula
```

**Release flow:**

```
git tag v1.2.0 → gh release create
  │
  ├─ ci.yml (PR checks)
  │
  └─ homebrew-release.yml
      ├─ validate    npm ci → version check → build → test → bundle
      ├─ prepare     curl tarball (5 retries, 30s timeout) → sha256sum
      └─ update      → Data-Wise/homebrew-tap/update-formula.yml@main
                        → PR: bump himalaya-mcp to v1.2.0
```

## Module Map

```
src/
├── index.ts              Entry point — creates McpServer, registers everything
├── config.ts             Reads HIMALAYA_* env vars → HimalayaClientOptions
│
├── himalaya/
│   ├── client.ts         HimalayaClient — subprocess wrapper
│   │                     execFile("himalaya", [...args, "--output", "json"])
│   ├── parser.ts         parseEnvelopes, parseMessageBody, parseFolders
│   │                     formatEnvelope — human-readable one-liner
│   └── types.ts          Envelope, Folder, HimalayaClientOptions, *Params
│
├── tools/
│   ├── inbox.ts          list_emails, search_emails
│   ├── read.ts           read_email, read_email_html
│   ├── manage.ts         flag_email, move_email
│   ├── compose.ts        draft_reply, send_email (safety gate)
│   └── actions.ts        export_to_markdown, create_action_item
│
├── prompts/
│   ├── triage.ts         triage_inbox — classify actionable/FYI/skip
│   ├── summarize.ts      summarize_email — one-sentence + action items
│   ├── digest.ts         daily_email_digest — priority-grouped markdown
│   └── reply.ts          draft_reply — guided reply composition
│
├── resources/
│   └── index.ts          email://inbox, email://message/{id}, email://folders
│
├── adapters/
│   └── clipboard.ts      copy_to_clipboard — pbcopy (macOS) / xclip (Linux)
│
└── cli/
    └── setup.ts          Claude Desktop setup (add/check/remove MCP config)
```

## Data Flow

### Read Path

```
list_emails
  → client.listEnvelopes(folder, pageSize, page, account)
    → execFile("himalaya", ["envelope", "list", "--page-size", N, "--output", "json"])
      → parseEnvelopes(stdout) → Envelope[]
        → formatEnvelope(each) → "ID | From | Subject | Date | Flags"
```

### Send Path (Two-Phase Safety Gate)

```
Phase 1: Preview
  draft_reply(id)
    → client.replyTemplate(id) → template string
      → Return "--- DRAFT REPLY (not sent) ---"

  send_email(template, confirm=false)
    → Return "--- EMAIL PREVIEW (not sent) ---"

Phase 2: Confirmed Send
  send_email(template, confirm=true)
    → client.sendTemplate(template)
      → execFile("himalaya", ["template", "send", template])
        → "Email sent successfully."
```

### Triage Path

```
triage_inbox prompt
  → Returns guide text instructing Claude to:
    1. list_emails(page_size: N)
    2. read_email on each
    3. Classify: Actionable / FYI / Skip
    4. Present table
    5. Wait for user confirmation before flag/move
```

## Plugin Structure

```
.claude-plugin/
  plugin.json         Manifest — declares skills, agents, hooks, MCP server
  marketplace.json    GitHub plugin discovery (self-hosted marketplace)

plugin/
  skills/
    inbox.md          /email:inbox — list recent emails
    triage.md         /email:triage — classify and organize
    digest.md         /email:digest — daily summary
    reply.md          /email:reply — draft with safety gate

  agents/
    email-assistant.md  Autonomous triage agent (all 11 tools)

.mcp.json             MCP server config (node dist/index.js)
```

## Security Boundaries

| Layer | Protection |
|-------|------------|
| Subprocess | `execFile` (not `exec`) — no shell injection |
| Authentication | Local only — himalaya handles auth, no tokens in MCP |
| Send gate | `confirm=true` required — preview-first by default |
| Delete | Not implemented — only flag/move |
| Bulk | Agent asks before operating on 5+ emails |
| Account | Per-call `account` param — no cross-account leaks |
