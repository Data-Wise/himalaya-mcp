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
└── adapters/
    └── clipboard.ts      copy_to_clipboard — pbcopy (macOS) / xclip (Linux)
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
