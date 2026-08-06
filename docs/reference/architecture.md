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
│                                     │  Tools (29)          │    │
│                                     │  Prompts (7)         │    │
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
Homebrew (Primary)                  GitHub (Fallback)                    .mcpb (Claude Desktop)
  brew install himalaya-mcp           claude plugin marketplace add ...     Download .mcpb from GitHub Releases
  │                                   claude plugin install himalaya           Double-click to install in Desktop
  ├─ depends_on "himalaya"            │                                     │
  ├─ depends_on "node"                └─ Copies plugin to cache             ├─ ~150 KB package (bundled server)
                                                                            ├─ Configurable: binary path, account, folder
                                                                            └─ Requires: brew install himalaya
  │
  ├─ libexec/
  │   ├─ .claude-plugin/plugin.json
  │   ├─ .claude-plugin/marketplace.json
  │   ├─ .mcp.json
  │   ├─ skills/*/SKILL.md
  │   ├─ agents/*.md
  │   ├─ hooks/*.sh
  │   └─ dist/index.js (esbuild bundle, ~908KB)
  │
  └─ post_install → himalaya-mcp-install
      ├─ symlink → ~/.claude/plugins/himalaya-mcp
      ├─ register → ~/.claude/local-marketplace/marketplace.json
      └─ auto-enable → ~/.claude/settings.json
```

The GitHub marketplace plugin definition also includes
`himalaya-mcp-plugin/.mcp.json`. Claude Code resolves plugin MCP configuration
relative to the installed plugin root; the Homebrew installer copies the
server bundle into that same root.

### Build Pipeline

```
src/index.ts (16 files)
  │
  ├─ npm run build          → dist/*.js + .d.ts (development)
  │
  └─ npm run build:bundle   → dist/index.js (~908KB, production)
      esbuild --bundle --platform=node --target=node22 --format=esm --minify
      Inlines: @modelcontextprotocol/sdk, zod, content-type, raw-body
```

### CI/CD Workflows

```
.github/workflows/
├── ci.yml                 Push/PR to main|dev — lint, typecheck, build, test, bundle, validate plugin
├── docs.yml               Push to main (docs/**) — deploy GitHub Pages
├── homebrew-release.yml   Release published — validate → compute SHA → update homebrew-tap formula
└── aggregator-sync.yml    Release published — sync marketplace listing to Data-Wise/claude-plugins
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
                        ├─ checkout with persist-credentials: false
                        ├─ unset GITHUB_TOKEN (bypass runner credential helper)
                        └─ direct push to main (auto_merge=true)
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
│   ├── thread-parser.ts  Thread/conversation grouping by subject line
│   ├── errors.ts         MCPError envelope, HimalayaError class,
│   │                     classifyStderr (stderr-pattern → stable code)
│   ├── accounts.ts       discoverAccounts — `himalaya account list --json`
│   ├── trash.ts          getTrashFolder — provider-agnostic trash detection
│   └── types.ts          Envelope, Folder, HimalayaClientOptions, *Params
│
├── tools/
│   ├── inbox.ts          list_emails, search_emails
│   ├── read.ts           read_email, read_email_html
│   ├── read-raw.ts       read_email_raw
│   ├── render.ts         render_email
│   ├── unread.ts         get_unread_count
│   ├── list-starred.ts   list_starred
│   ├── manage.ts         flag_email, move_email
│   ├── compose.ts        draft_reply, send_email (safety gate)
│   ├── compose-new.ts    compose_email (new messages, safety gate)
│   ├── folders.ts        list_folders, create_folder, delete_folder
│   ├── attachments.ts    list_attachments, download_attachment
│   ├── calendar.ts       extract_calendar_event, create_calendar_event
│   ├── threads.ts        list_threads, read_thread
│   ├── reminders.ts      create_reminder (Apple Reminders)
│   ├── snooze.ts         snooze_email, list_snoozed_emails
│   ├── health.ts         health_check — per-account IMAP reachability
│   └── actions.ts        export_to_markdown, create_action_item
│
├── prompts/
│   ├── triage.ts         triage_inbox — classify actionable/FYI/skip
│   ├── summarize.ts      summarize_email — one-sentence + action items
│   ├── digest.ts         daily_email_digest — priority-grouped markdown
│   ├── weekly-digest.ts  weekly_email_digest — digest grouped by day
│   ├── reply.ts          draft_reply — guided reply composition
│   ├── morning.ts        morning_briefing — urgency classification
│   └── inbox-check.ts    inbox_check — quick inbox status
│
├── resources/
│   └── index.ts          email://inbox, email://message/{id}, email://folders
│
├── adapters/
│   ├── clipboard.ts      copy_to_clipboard — pbcopy (macOS) / xclip (Linux)
│   ├── reminders.ts      Apple Reminders adapter (osascript)
│   └── calendar.ts       ICS parser + Apple Calendar (osascript)
│
└── cli/
    └── setup.ts          Claude Desktop setup (setup/check/remove MCP config + install-ext/remove-ext)
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
  hooks/
    pre-send.sh       PreToolUse hook — email send preview + audit log

plugin/
  skills/
    inbox.md          /himalaya:inbox — list recent emails
    triage.md         /himalaya:triage — classify and organize
    digest.md         /himalaya:digest — daily summary
    reply.md          /himalaya:reply — draft with safety gate
    compose.md        /himalaya:compose — compose new emails
    respond.md        /himalaya:respond — read, understand, and reply
    morning.md        /himalaya:morning — morning briefing
    attachments.md    /himalaya:attachments — files and calendar
    forward.md        /himalaya:forward — forward with attribution
    export.md         /himalaya:export — export to markdown
    threads.md        /himalaya:threads — conversation threads
    search.md         /himalaya:search — search with filters
    manage.md         /himalaya:manage — bulk operations
    stats.md          /himalaya:stats — inbox statistics
    config.md         /himalaya:config — setup wizard
    help.md           /himalaya:help — help hub

  agents/
    email-assistant.md  Autonomous triage agent (all 29 tools)

.mcp.json             MCP server config (node dist/index.js)
```

## Reliability & Error Model

himalaya-mcp turns raw himalaya stderr into a stable, structured error envelope so tool handlers and Claude can reason about failures without parsing strings.

### Error envelope

`MCPError` (defined in `src/himalaya/errors.ts`):

```
code         stable identifier (e.g., imap_auth_failed, transient, account_not_found)
message      human-readable error
hint         one-line suggested fix (e.g., "Run: himalaya account configure <account>")
account      which account failed (multi-account aware)
recoverable  whether the operation is worth retrying
attempts     retry count surfaced to the caller (1 = first try, 2 = retried once)
rawStderr    original stderr preserved for debugging
```

`HimalayaError extends Error` carries the envelope. `client.ts` is the sole thrower; tool handlers catch it and surface the envelope via `envelopeError`.

### Stderr-pattern classifier

`classifyStderr(stderr, account)` scans stderr against an ordered pattern table:

| Code | Pattern (substring/regex) | Hint |
|------|---------------------------|------|
| `transient` | `ECONNRESET`, `ETIMEDOUT`, `* BYE` | auto-retried; check network if persistent |
| `imap_auth_failed` | `AUTHENTICATIONFAILED`, `Invalid credentials`, `authentication failed` | Re-check app password |
| `imap_cert_error` | `certificate verify failed`, `self-signed certificate` | Trust cert or set `insecure = true` |
| `account_not_found` | `Cannot find account` | `himalaya account list` |
| `folder_not_found` | `No such folder`, `Mailbox doesn't exist` | `himalaya folder list` |
| `message_not_found` | `Message not found` | UID may be stale |
| `himalaya_not_installed` | `command not found: himalaya`, `spawn himalaya ENOENT` | `brew install himalaya` |
| `himalaya_config_missing` | `Cannot find config` | `himalaya account configure` |

Process-level failures (ENOENT, killed-by-timeout) are detected before stderr classification:

- `ENOENT` → `himalaya_not_installed`
- `killed = true` (execFile timeout) → `imap_timeout`

Anything not matched falls through to `code: "unknown"` with the raw stderr preserved.

### Retry policy

`HimalayaClient` retries a subprocess once on the `transient` code with a 200ms backoff (configurable via `retryBackoffMs` option). Other recoverable codes are surfaced without retry — including `imap_timeout`, which already represents a timeout and benefits from user remediation rather than blind retry. `attempts` is included in the envelope so callers can distinguish first-try failures from post-retry surfaces.

### Multi-account discovery

`discoverAccounts()` in `src/himalaya/accounts.ts` parses `himalaya account list --json`. Used by:

- `himalaya-mcp doctor` (default mode iterates all accounts)
- `health_check` MCP tool (default mode iterates all accounts)
- `--account <name>` flags target a single account

## Security Boundaries

| Layer | Protection |
|-------|------------|
| Subprocess | `execFile` (not `exec`) — no shell injection |
| Authentication | Local only — himalaya handles auth, no tokens in MCP |
| Send gate | `confirm=true` required — preview-first by default |
| Hook gate | PreToolUse `pre-send.sh` — stderr preview before send, audit log |
| Delete | Not implemented — only flag/move |
| Bulk | Agent asks before operating on 5+ emails |
| Account | Per-call `account` param — no cross-account leaks |
