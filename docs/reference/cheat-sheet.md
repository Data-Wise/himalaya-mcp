# Cheat Sheet

## Install

```
brew tap data-wise/tap && brew install himalaya-mcp   # Homebrew (recommended)
claude plugin marketplace add Data-Wise/himalaya-mcp  # GitHub (requires node+himalaya)
claude plugin install email                           # ...then install plugin
himalaya-mcp install-ext                              # Desktop extension
himalaya-mcp doctor                                   # Verify everything
```

## CLI

| Command | Purpose |
|---------|---------|
| `himalaya-mcp doctor` | Diagnose full stack |
| `himalaya-mcp doctor --fix` | Auto-fix common issues |
| `himalaya-mcp doctor --account <name>` | Check one account |
| `himalaya-mcp setup` | Add MCP server to Claude Desktop |
| `himalaya-mcp install-ext` | Install .mcpb extension |
| `himalaya-mcp remove-ext` | Remove .mcpb extension |
| `himalaya-mcp --help` | Show help |
| `himalaya-mcp --version` | Show version |

## MCP Tools (29)

```
list_emails         List inbox/folder emails
search_emails       Search by subject, from, body
read_email          Read plain text body
read_email_html     Read HTML body
read_email_raw      Read raw MIME source
render_email        Read as clean markdown
flag_email          Add/remove flags (Seen, Flagged, etc.)
get_unread_count    Get unread count in folder
move_email          Move to another folder
compose_email       Compose + send new email (safety gate)
draft_reply         Generate reply draft (never sends)
send_email          Send template (confirm=true required)
list_folders        List all folders
list_starred        List flagged/starred emails
create_folder       Create new folder
delete_folder       Delete folder (safety gate)
list_attachments    List email attachments
download_attachment Download attachment to temp dir
extract_calendar_event  Parse ICS invite from email
create_calendar_event   Add to Apple Calendar (macOS)
list_threads        List conversation threads
read_thread         Read all messages in a thread
export_to_markdown  Email → markdown + YAML frontmatter
create_action_item  Extract todos and deadlines
copy_to_clipboard   Copy text to clipboard
health_check        Diagnose account connectivity
```

## MCP Prompts (6)

```
triage_inbox        Classify emails: actionable/FYI/skip
summarize_email     One-sentence summary + action items
daily_email_digest  Priority-grouped markdown digest
draft_reply         Guided reply composition
morning_briefing    Morning briefing with urgency
inbox_check         Quick inbox status + highlights
```

## MCP Resources (3)

```
email://inbox           Recent inbox envelopes
email://message/{id}    Full message body
email://folders         All available folders
```

## Safety Gates

| Action | Without confirm | With confirm=true |
|--------|----------------|-------------------|
| `send_email` | Preview only | Sends |
| `compose_email` | Preview only | Sends |
| `delete_folder` | Warning | Deletes |
| `create_calendar_event` | Preview | Creates in Calendar |

## Common Flags

```
Seen       Mark as read
Flagged    Star/important
Answered   Has been replied to
Deleted    Marked for deletion
Draft      Draft message
```

## Plugin Skills (12)

```
/email:inbox        /email:triage      /email:digest
/email:reply        /email:compose     /email:attachments
/email:search       /email:manage      /email:stats
/email:config       /email:help        /email:morning
```

## Env Vars

| Variable | Default | Description |
|----------|---------|-------------|
| `HIMALAYA_BINARY` | `himalaya` | Path to himalaya binary |
| `HIMALAYA_ACCOUNT` | (default) | Default account name |
| `HIMALAYA_FOLDER` | `INBOX` | Default folder |
| `HIMALAYA_TIMEOUT` | `120000` | Command timeout (ms) |

## Common Workflows

```
Triage:     list → read → flag / move
Reply:      read → draft → review → send(confirm)
Compose:    compose(preview) → review → compose(confirm)
Search:     search → read → flag/reply
Bulk:       /email:manage [action] [ids]
Export:     read → export_to_markdown → copy_to_clipboard
Calendar:   list_attachments → extract → create(confirm)
Multi-acct: Any tool + account="work" | account="personal"
```

## Build

```
npm run build           tsc (dev)
npm run build:bundle    esbuild (~604KB)
npm run build:mcpb      .mcpb extension (~151KB)
npm test                507 tests (vitest)
```

## Resources

- **[MCP Tools](commands.md)** — full reference with params and examples
- **[CLI Reference](cli.md)** — `doctor`, `setup`, `install-ext`, `remove-ext`
- **[Tutorials](../tutorials/index.md)** — step-by-step guides
- **[Workflows](../guide/workflows.md)** — common email patterns
- **[Cookbook](../guide/cookbook.md)** — practical recipes
- **[Architecture](../reference/architecture.md)** — system design
