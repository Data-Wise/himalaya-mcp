# Quick Reference

## Install

```
brew tap data-wise/tap && brew install himalaya-mcp   # Homebrew (recommended)
claude plugin marketplace add Data-Wise/himalaya-mcp  # GitHub (step 1: add marketplace)
claude plugin install email                     # GitHub (step 2: install plugin)
himalaya-mcp setup                                     # Claude Desktop config (legacy)
himalaya-mcp install-ext                               # Claude Desktop extension (.mcpb)
# Or: Download .mcpb from GitHub Releases, double-click to install
```

## CLI Commands

```
himalaya-mcp setup              Add MCP server to Claude Desktop config
himalaya-mcp setup --check      Verify configuration exists and paths valid
himalaya-mcp setup --remove     Remove MCP server entry
himalaya-mcp install-ext [file] Install .mcpb as Desktop extension
himalaya-mcp remove-ext         Remove Desktop extension
```

## Tools (19)

```
list_emails         [folder] [page_size] [page] [account]     List envelopes
search_emails       query [folder] [account]                   Search emails
read_email          id [folder] [account]                      Read plain text
read_email_html     id [folder] [account]                      Read HTML
list_folders        [account]                                  List all folders
create_folder       name [account]                             Create new folder
delete_folder       name [account]                             Delete folder
flag_email          id flags action("add"|"remove") [folder]   Set/clear flags
move_email          id target_folder [folder] [account]        Move to folder
compose_email       to subject body [account]                  Compose new email
draft_reply         id [body] [reply_all] [folder] [account]   Generate draft (no send)
send_email          template [confirm] [account]               Send (confirm=true required)
list_attachments    id [folder] [account]                      List email attachments
download_attachment id attachment_name [folder] [account]      Download attachment
extract_calendar_event  id [folder] [account]                  Extract calendar from email
create_calendar_event   event_data                             Create calendar event
export_to_markdown  id [folder] [account]                      Email -> markdown + YAML
create_action_item  id [folder] [account]                      Extract todos/deadlines
copy_to_clipboard   text                                       Copy to system clipboard
```

## Prompts (4)

```
triage_inbox         [count=10]              Classify emails: actionable/FYI/skip
summarize_email      id [folder]             One-sentence summary + action items
daily_email_digest   (none)                  Priority-grouped markdown digest
draft_reply          id [tone] [instructions] Guided reply composition
```

## Resources (3)

```
email://inbox           Recent inbox envelopes
email://message/{id}    Full message body
email://folders         All available folders
```

## Common Flags

```
Seen       Mark as read
Flagged    Star/important
Answered   Has been replied to
Deleted    Marked for deletion
Draft      Draft message
```

## Plugin Skills (Claude Code only)

```
/email:inbox        List recent emails, offer to read/triage/reply
/email:triage       Classify inbox, suggest flags and moves
/email:digest       Generate daily priority digest
/email:reply        Draft reply with safety gate workflow
/email:compose      Compose new email with safety gate
/email:attachments  List/download attachments, calendar invites
/email:help         Help hub — browse tools, prompts, workflows
```

## Environment Variables

```
HIMALAYA_BINARY    Path to himalaya binary       (default: himalaya)
HIMALAYA_ACCOUNT   Default account name          (default: system default)
HIMALAYA_FOLDER    Default folder                (default: INBOX)
HIMALAYA_TIMEOUT   Command timeout in ms         (default: 30000)
```

## Safety Gates

```
send_email(template, confirm=false)           ->  PREVIEW only (not sent)
send_email(template, confirm=true)            ->  Actually sends
compose_email(..., confirm=false)             ->  PREVIEW only (not sent)
compose_email(..., confirm=true)              ->  Actually sends
delete_folder(name, confirm=false)            ->  Warning (not deleted)
delete_folder(name, confirm=true)             ->  Deletes
create_calendar_event(..., confirm=false)     ->  Preview (not created)
create_calendar_event(..., confirm=true)      ->  Creates in Apple Calendar
```

## Common Workflows

```
Triage:     list_emails -> read_email -> flag_email / move_email
Reply:      read_email -> draft_reply -> [review] -> send_email(confirm=true)
Compose:    compose_email(preview) -> [review] -> compose_email(confirm=true)
Export:     read_email -> export_to_markdown -> copy_to_clipboard
Attach:     list_attachments -> download_attachment -> [use file]
Calendar:   extract_calendar_event -> [review] -> create_calendar_event(confirm=true)
Folders:    list_folders -> create_folder / delete_folder(confirm=true)
Digest:     triage_inbox prompt -> daily_email_digest prompt
Multi-acct: Any tool + account="work" | account="personal"
```

## Build & Distribution

```
npm run build           TypeScript compilation (development)
npm run build:bundle    esbuild single-file bundle (~595KB, production)
npm run build:mcpb      Build .mcpb Desktop Extension (~147KB)
npm test                Run 308 tests (vitest)
node dist/index.js      Start MCP server standalone
```

## Distribution Channels

```
Homebrew:    brew install data-wise/tap/himalaya-mcp
GitHub:      claude plugin marketplace add Data-Wise/himalaya-mcp && claude plugin install email
Desktop:     himalaya-mcp install-ext (or double-click .mcpb from GitHub Releases)
Source:      git clone + npm install + npm run build
```
