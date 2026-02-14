# himalaya-mcp Quick Reference

## Install

```
brew tap data-wise/tap && brew install himalaya-mcp   # Homebrew (recommended)
claude plugin add github:Data-Wise/himalaya-mcp       # GitHub
himalaya-mcp setup                                     # Claude Desktop config
himalaya-mcp setup --check                             # Verify Desktop config
himalaya-mcp setup --remove                            # Remove Desktop config
```

## Tools

```
list_emails      [folder] [page_size] [page] [account]     List envelopes
search_emails    query [folder] [account]                   Search emails
read_email       id [folder] [account]                      Read plain text
read_email_html  id [folder] [account]                      Read HTML
flag_email       id flags action("add"|"remove") [folder]   Set/clear flags
move_email       id target_folder [folder] [account]        Move to folder
draft_reply      id [body] [reply_all] [folder] [account]   Generate draft (no send)
send_email       template [confirm] [account]               Send (confirm=true required)
export_to_markdown  id [folder] [account]                   Email -> markdown + YAML
create_action_item  id [folder] [account]                   Extract todos/deadlines
copy_to_clipboard   text                                    Copy to system clipboard
```

## Prompts

```
triage_inbox         [count=10]              Classify emails: actionable/FYI/skip
summarize_email      id [folder]             One-sentence summary + action items
daily_email_digest   (none)                  Priority-grouped markdown digest
draft_reply          id [tone] [instructions] Guided reply composition
```

## Resources

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

## Plugin Skills

```
/email:inbox     List recent emails, offer to read/triage/reply
/email:triage    Classify inbox, suggest flags and moves
/email:digest    Generate daily priority digest
/email:reply     Draft reply with safety gate workflow
/email:help      Help hub — browse tools, prompts, workflows
```

## Environment Variables

```
HIMALAYA_BINARY    Path to himalaya binary       (default: himalaya)
HIMALAYA_ACCOUNT   Default account name          (default: system default)
HIMALAYA_FOLDER    Default folder                (default: INBOX)
HIMALAYA_TIMEOUT   Command timeout in ms         (default: 30000)
```

## Safety Gate (send_email)

```
send_email(template, confirm=false)  ->  PREVIEW only (not sent)
send_email(template, confirm=true)   ->  Actually sends
```

## Common Workflows

```
Triage:     list_emails -> read_email -> flag_email / move_email
Reply:      read_email -> draft_reply -> [review] -> send_email(confirm=true)
Export:     read_email -> export_to_markdown -> copy_to_clipboard
Digest:     triage_inbox prompt -> daily_email_digest prompt
Multi-acct: Any tool + account="work" | account="personal"
```

## Build & Distribution

```
npm run build           TypeScript compilation (development)
npm run build:bundle    esbuild single-file bundle (583KB, production)
npm test                Run 160 tests (vitest)
node dist/index.js      Start MCP server standalone
```

## Distribution Channels

```
Homebrew:    brew install data-wise/tap/himalaya-mcp
GitHub:      claude plugin add github:Data-Wise/himalaya-mcp
Source:      git clone + npm install + npm run build
```
