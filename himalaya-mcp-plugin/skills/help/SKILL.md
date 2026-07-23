---
name: help
description: This skill should be used when the user asks for "email help", "himalaya help", "email commands", "what can you do with email", "email features", "how do I use email", "what email tools are available", "show email capabilities", or wants to discover available email capabilities. Help hub for browsing all tools, prompts, skills, and workflows.
triggers:
  - email help
  - himalaya help
  - email commands
  - what can you do with email
  - email features
  - how do I use email
---

# /himalaya:help - Email Help Hub

Single entry point for discovering all email commands, tools, prompts, and workflows.

## Usage

```
/himalaya:help                  # Overview of all capabilities
/himalaya:help tools            # All 29 MCP tools with usage
/himalaya:help prompts          # All 7 MCP prompts
/himalaya:help resources        # All 3 MCP resources
/himalaya:help <command>        # Detail for a specific tool (e.g. "search_emails")
/himalaya:help workflows        # Common workflow patterns
/himalaya:help quick            # One-line reference table
```

## When Invoked (No Args) — Overview

Display the hub overview:

```
+-----------------------------------------------------------+
| EMAIL HELP HUB                                            |
+-----------------------------------------------------------+
| Privacy-first email for Claude — 29 tools, 7 prompts,     |
| 3 resources, 16 skills, 2 hooks                           |
+===========================================================+
|                                                           |
| TOOLS (29)                                                |
|   Inbox ....... list_emails, search_emails                |
|   Read ........ read_email, read_email_html,              |
|                 read_email_raw, render_email               |
|   Info ........ get_unread_count, list_starred            |
|   Folders ..... list_folders, create_folder,              |
|                 delete_folder                              |
|   Manage ...... flag_email, move_email                    |
|   Snooze ...... snooze_email, list_snoozed_emails         |
|   Compose ..... compose_email, draft_reply, send_email    |
|   Attachments . list_attachments, download_attachment      |
|   Calendar .... extract_calendar_event,                   |
|                 create_calendar_event                      |
|   Threads ..... list_threads, read_thread                 |
|   Actions ..... export_to_markdown, create_action_item    |
|   Adapters .... copy_to_clipboard, create_reminder        |
|   Diagnostics . health_check                              |
|                                                           |
| PROMPTS (7)                                               |
|   triage_inbox, summarize_email, daily_email_digest,      |
|   weekly_email_digest, draft_reply, morning_briefing,     |
|   inbox_check                                               |
|                                                           |
| RESOURCES (3)                                             |
|   email://inbox, email://folders, email://message/{id}    |
|                                                           |
| SKILLS (16)                                               |
|   /himalaya:inbox, /himalaya:triage, /himalaya:digest,             |
|   /himalaya:reply, /himalaya:compose, /himalaya:attachments,       |
|   /himalaya:forward, /himalaya:export, /himalaya:threads,          |
|   /himalaya:search, /himalaya:manage, /himalaya:stats,             |
|   /himalaya:config, /himalaya:help, /himalaya:morning,             |
|   /himalaya:respond                                          |
|                                                           |
| HOOKS (2)                                                 |
|   session ...... Context injection at conversation start   |
|   pre-send .... Preview gate before send/compose          |
|                                                           |
+-----------------------------------------------------------+
| /himalaya:help tools        Detailed tool reference          |
| /himalaya:help prompts      Prompt usage guide               |
| /himalaya:help workflows    Common email patterns            |
| /himalaya:help quick        One-line cheat sheet             |
+-----------------------------------------------------------+
```

## When Invoked with "tools"

Display all 29 tools grouped by category:

```
+-----------------------------------------------------------+
| TOOLS REFERENCE                                           |
+===========================================================+
|                                                           |
| INBOX & SEARCH                                            |
|                                                           |
|   list_emails                                             |
|     List emails in a folder with envelope data            |
|     Params: folder?, page_size?, page?, account?          |
|     Example: "Show my last 10 emails"                     |
|                                                           |
|   search_emails                                           |
|     Search using himalaya filter syntax                   |
|     Params: query (required), folder?, account?           |
|     Example: "Find emails from Alice about invoices"      |
|     Syntax: subject, from, to, body, date, before,        |
|             after, flag — combine with and/or/not          |
|                                                           |
|   get_unread_count                                        |
|     Get number of unread emails in a folder               |
|     Params: folder?, account?                             |
|     Example: "How many unread emails do I have?"          |
|                                                           |
|   list_starred                                            |
|     List flagged/starred emails                           |
|     Params: folder?, account?                             |
|     Example: "Show my starred emails"                     |
|                                                           |
| READING                                                   |
|                                                           |
|   read_email                                              |
|     Read message body (plain text)                        |
|     Params: id (required), folder?, account?              |
|                                                           |
|   read_email_html                                         |
|     Read message body (HTML)                              |
|     Params: id (required), folder?, account?              |
|     Use for: newsletters, formatted emails                |
|                                                           |
|   read_email_raw                                          |
|     Read raw MIME source including headers                |
|     Params: id (required), folder?, account?              |
|     Use for: forensics, .eml export                       |
|                                                           |
|   render_email                                            |
|     Read body as clean markdown                           |
|     Params: id (required), folder?, account?              |
|     Use for: HTML emails without clutter                  |
|                                                           |
| FOLDERS                                                   |
|                                                           |
|   list_folders                                            |
|     List all email folders/mailboxes                      |
|     Params: account?                                      |
|                                                           |
|   create_folder                                           |
|     Create a new folder                                   |
|     Params: name (required), account?                     |
|                                                           |
|   delete_folder                                           |
|     Delete folder (safety gate: confirm=true)             |
|     Params: name (required), confirm?, account?           |
|                                                           |
| MANAGING                                                  |
|                                                           |
|   flag_email                                              |
|     Add/remove flags: Seen, Flagged, Answered,            |
|     Deleted, Draft                                        |
|     Params: id, flags[], action (add/remove),             |
|             folder?, account?                             |
|                                                           |
|   move_email                                              |
|     Move to folder: Archive, Trash, Spam, etc.            |
|     Params: id, target_folder (required),                 |
|             folder?, account?                             |
|                                                           |
| SNOOZE                                                    |
|                                                           |
|   snooze_email                                            |
|     Snooze email until specified time                     |
|     Params: id, snoozeUntil (required), folder?,          |
|             account?, subject?                            |
|     Shorthand: tomorrow, monday, 2h, 1d                   |
|                                                           |
|   list_snoozed_emails                                     |
|     List active and expired snoozes                       |
|     Params: none                                          |
|                                                           |
| COMPOSE                                                   |
|                                                           |
|   compose_email                                           |
|     Compose new email (safety gate: confirm=true)         |
|     Params: to, subject, body (required),                 |
|             cc?, bcc?, confirm?, account?                 |
|                                                           |
|   draft_reply                                             |
|     Generate reply template (does NOT send)               |
|     Params: id, body?, reply_all?, folder?, account?      |
|                                                           |
|   send_email                                              |
|     Send with two-phase safety gate                       |
|     Params: template, confirm? (must be true to send),    |
|             account?                                      |
|     SAFETY: without confirm=true, shows preview only      |
|                                                           |
| ATTACHMENTS                                               |
|                                                           |
|   list_attachments                                        |
|     List attachments (filename, MIME, size)                |
|     Params: id (required), folder?, account?              |
|                                                           |
|   download_attachment                                     |
|     Download specific attachment to temp dir              |
|     Params: id, filename (required), folder?, account?    |
|                                                           |
| CALENDAR                                                  |
|                                                           |
|   extract_calendar_event                                  |
|     Parse ICS calendar invite from email                  |
|     Params: id (required), folder?, account?              |
|                                                           |
|   create_calendar_event                                   |
|     Create Apple Calendar event (macOS, confirm=true)     |
|     Params: summary, dtstart, dtend (required),           |
|             location?, description?, confirm?             |
|                                                           |
| ACTIONS                                                   |
|                                                           |
|   export_to_markdown                                      |
|     Export as markdown with YAML frontmatter              |
|     Params: id (required), folder?, account?              |
|                                                           |
|   create_action_item                                      |
|     Extract todos, deadlines, commitments                 |
|     Params: id (required), folder?, account?              |
|                                                           |
| THREADS                                                   |
|                                                           |
|   list_threads                                            |
|     List email threads grouped by conversation            |
|     Params: folder?, page_size?, account?                 |
|     Example: "Show my email conversations"                |
|                                                           |
|   read_thread                                             |
|     Read all messages in a thread chronologically         |
|     Params: thread_id (required), folder?, account?       |
|     Example: "Show me the full thread about project X"    |
|                                                           |
| ADAPTERS                                                  |
|                                                           |
|   copy_to_clipboard                                       |
|     Copy text to system clipboard                         |
|     Params: text (required)                               |
|                                                           |
|   create_reminder                                         |
|     Create reminder in Apple Reminders (macOS)            |
|     Params: title (required), notes?, dueDate?,           |
|             priority?                                     |
|                                                           |
| DIAGNOSTICS                                               |
|                                                           |
|   health_check                                            |
|     Check per-account IMAP connectivity                   |
|     Params: account? (defaults to all)                    |
|     Example: "Run a health check on my email accounts"    |
|                                                           |
+-----------------------------------------------------------+
| /himalaya:help <tool_name>   Detail for specific tool        |
+-----------------------------------------------------------+
```

## When Invoked with "prompts"

Display all 7 prompts:

```
+-----------------------------------------------------------+
| PROMPTS REFERENCE                                         |
+===========================================================+
|                                                           |
|   triage_inbox                                            |
|     Classify emails as Actionable / FYI / Skip            |
|     Params: count? (default: "10")                        |
|     Output: Table with classification + suggested actions  |
|     "Triage my last 20 emails"                            |
|                                                           |
|   summarize_email                                         |
|     One-sentence summary + action items + priority        |
|     Params: id (required), folder?                        |
|     "Summarize email 42"                                  |
|                                                           |
|   daily_email_digest                                      |
|     Markdown digest grouped by priority                   |
|     Params: (none)                                        |
|     "Give me today's email digest"                        |
|                                                           |
|   weekly_email_digest                                     |
|     Markdown digest grouped by day and priority           |
|     Params: (none)                                        |
|     "Give me this week's email digest"                    |
|                                                           |
|   draft_reply                                             |
|     Guided reply with tone control                        |
|     Params: id (required), tone?, instructions?           |
|     Tones: professional, casual, brief, detailed          |
|     "Reply casually to email 42"                          |
|                                                           |
|   morning_briefing                                        |
|     Morning email briefing with urgency classification    |
|     Params: account?                                      |
|     Categories: Needs Reply Today, FYI, Newsletter/Promo  |
|     "Give me my morning email briefing"                   |
|                                                           |
|   inbox_check                                             |
|     Quick inbox status with highlights                    |
|     Params: folder?, account?                             |
|     "Quick check on my inbox"                             |
|                                                           |
+-----------------------------------------------------------+
```

## When Invoked with "resources"

```
+-----------------------------------------------------------+
| RESOURCES                                                 |
+===========================================================+
|                                                           |
|   email://inbox                                           |
|     Browse current inbox (read-only)                      |
|                                                           |
|   email://folders                                         |
|     List available email folders                          |
|                                                           |
|   email://message/{id}                                    |
|     Read specific message by ID                           |
|     Example: email://message/42                           |
|                                                           |
+-----------------------------------------------------------+
```

## When Invoked with "workflows"

```
+-----------------------------------------------------------+
| COMMON WORKFLOWS                                          |
+===========================================================+
|                                                           |
| MORNING TRIAGE                                            |
|   "Triage my last 20 emails"                              |
|   → triage_inbox(count: 20)                               |
|   → Review table, approve flag/move actions               |
|                                                           |
| DAILY DIGEST                                              |
|   "Give me today's email digest"                          |
|   → daily_email_digest prompt                             |
|   → Get priority-grouped summary                          |
|                                                           |
| REPLY TO EMAIL                                            |
|   "Reply to email 42 professionally"                      |
|   → draft_reply prompt(id: 42, tone: professional)        |
|   → Review draft → confirm send                           |
|                                                           |
| EXPORT FOR NOTES                                          |
|   "Export email 42 to markdown and copy it"               |
|   → export_to_markdown(id: 42)                            |
|   → copy_to_clipboard(text: result)                       |
|                                                           |
| COMPOSE NEW EMAIL                                         |
|   "Email Alice about the meeting"                         |
|   → compose_email(to, subject, body)                      |
|   → Review preview → confirm send                         |
|                                                           |
| DOWNLOAD ATTACHMENTS                                      |
|   "What attachments does email 42 have?"                  |
|   → list_attachments(id: 42)                              |
|   → download_attachment(id: 42, filename: "report.pdf")   |
|                                                           |
| CALENDAR INVITE                                           |
|   "Check the meeting invite in email 42"                  |
|   → extract_calendar_event(id: 42)                        |
|   → Review event → create_calendar_event(confirm: true)   |
|                                                           |
| FOLDER MANAGEMENT                                         |
|   "Create a Projects folder"                              |
|   → create_folder(name: "Projects")                       |
|   → list_folders() to verify                              |
|                                                           |
| SEARCH + ACTION                                           |
|   "Find invoices from last month and flag them"           |
|   → search_emails(query: "subject invoice and             |
|     after 2026-01-01")                                    |
|   → flag_email on each result                             |
|                                                           |
| MULTI-ACCOUNT                                             |
|   "Check my work email"                                   |
|   → list_emails(account: "work")                          |
|   Every tool accepts account parameter                    |
|                                                           |
+-----------------------------------------------------------+
```

## When Invoked with "quick"

One-line cheat sheet:

```
+-----------------------------------------------------------+
| QUICK REFERENCE                                           |
+===========================================================+
| Tool                  | What it does                      |
|-----------------------+-----------------------------------|
| list_emails           | List inbox (paginated)            |
| search_emails         | Search by subject/from/body/date  |
| read_email            | Read plain text body              |
| read_email_html       | Read HTML body                    |
| read_email_raw        | Read raw MIME source              |
| render_email          | Read as clean markdown            |
| get_unread_count      | Count unread emails in folder     |
| list_starred          | List flagged/starred emails       |
| list_folders          | List all email folders            |
| create_folder         | Create new folder                 |
| delete_folder         | Delete folder (confirm=true)      |
| flag_email            | Star, mark read, etc.             |
| move_email            | Archive, trash, move to folder    |
| compose_email         | Compose new email (confirm=true)  |
| draft_reply           | Generate reply template           |
| send_email            | Send (requires confirm=true)      |
| list_attachments      | List email attachments            |
| download_attachment   | Download specific attachment      |
| extract_calendar_event| Parse ICS calendar invite         |
| create_calendar_event | Add to Apple Calendar (macOS)     |
| snooze_email          | Snooze email until time           |
| list_snoozed_emails   | List active/expired snoozes       |
| create_reminder       | Apple Reminders (macOS)           |
| export_to_markdown    | Email → markdown + frontmatter    |
| list_threads          | List conversation threads         |
| read_thread           | Read all messages in thread       |
| create_action_item    | Extract todos and deadlines       |
| copy_to_clipboard     | Copy text to clipboard            |
| health_check          | Per-account IMAP health           |
+-----------------------+-----------------------------------+
| Prompt            | What it does                          |
|-------------------+---------------------------------------|
| triage_inbox      | Classify inbox emails                 |
| summarize_email   | One-line summary + actions            |
| daily_email_digest| Priority-grouped digest               |
| weekly_email_digest| Week grouped by day and priority     |
| draft_reply       | Guided reply composition              |
| morning_briefing  | Morning briefing + urgency            |
| inbox_check       | Quick inbox status + highlights       |
+-------------------+---------------------------------------+
| Skill               | What it does                    |
|-----------------------+-----------------------------------|
| /himalaya:inbox        | Check inbox interactively         |
| /himalaya:triage       | AI-powered triage                 |
| /himalaya:digest       | Generate daily digest             |
| /himalaya:reply        | Draft and send replies            |
| /himalaya:compose      | Compose new email                 |
| /himalaya:forward      | Forward email with context        |
| /himalaya:attachments  | List/download/calendar            |
| /himalaya:export       | Export to markdown + clipboard    |
| /himalaya:threads      | Conversation thread view          |
| /himalaya:search       | Search by keyword/sender/flags    |
| /himalaya:manage       | Bulk flag/move/archive            |
| /himalaya:stats        | Inbox statistics + trends         |
| /himalaya:config       | Setup wizard + diagnostics        |
| /himalaya:morning      | Morning briefing + follow-ups     |
| /himalaya:respond      | Batch draft replies               |
| /himalaya:help         | This help hub                     |
+-----------------------------------------------------------+
```

## When Invoked with a Specific Tool Name

Show detailed info for that tool including all parameters, examples, and related commands. Pull from the tool registration in source code.

Example for `/himalaya:help search_emails`:

```
+-----------------------------------------------------------+
| search_emails                                             |
+===========================================================+
|                                                           |
| Search emails using himalaya filter syntax.               |
|                                                           |
| PARAMETERS                                                |
| ─────────────────────────────────────────────────────     |
|   query     string  REQUIRED  Search query                |
|   folder    string  optional  Folder (default: INBOX)     |
|   account   string  optional  Account name                |
|                                                           |
| FILTER SYNTAX                                             |
| ─────────────────────────────────────────────────────     |
|   subject <text>     Subject contains text                |
|   from <text>        Sender contains text                 |
|   to <text>          Recipient contains text              |
|   body <text>        Body contains text                   |
|   date <YYYY-MM-DD>  Sent on date                         |
|   before <date>      Sent before date                     |
|   after <date>       Sent after date                      |
|   flag <Flag>        Has flag (Seen, Flagged, etc.)       |
|                                                           |
| OPERATORS: and, or, not                                   |
|                                                           |
| EXAMPLES                                                  |
| ─────────────────────────────────────────────────────     |
|   "Find invoices"                                         |
|   → search_emails(query: "subject invoice")               |
|                                                           |
|   "Emails from Alice about meetings"                      |
|   → search_emails(query: "from alice and subject meeting")|
|                                                           |
|   "Unread from last week"                                 |
|   → search_emails(query: "not flag Seen and              |
|     after 2026-02-06")                                    |
|                                                           |
| RELATED: list_emails, read_email                          |
|                                                           |
+-----------------------------------------------------------+
```

## When something goes wrong

If an email operation fails, ask:

- "Run a health check on my email accounts."
- "Why is email failing?"

This invokes the `health_check` MCP tool. For detailed troubleshooting, see [docs/troubleshooting.md](../../../docs/troubleshooting.md).
