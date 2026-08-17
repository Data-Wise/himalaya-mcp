# MCP Tools Reference

Complete reference for all 29 MCP tools, 7 prompts, and 3 resources.

!!! tip "See also"
    **[Tutorials](../tutorials/index.md)** for step-by-step walkthroughs | **[Workflows](../guide/workflows.md)** for common email patterns

---

## Tools

### Inbox & Search

#### `list_emails`

List emails in a folder. Returns envelope data: subject, from, date, flags.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `folder` | string | No | `INBOX` | Folder name |
| `page_size` | number | No | `25` | Number of emails to return |
| `page` | number | No | `1` | Page number for pagination |
| `account` | string | No | default | Account name from himalaya config |

**Examples:**

```
"List my last 10 emails"
→ list_emails(page_size: 10)

"Show emails in Archive"
→ list_emails(folder: "Archive")

"Page 2 of my work inbox"
→ list_emails(page: 2, account: "work")
```

**Output:** One line per email with ID, flags, date, sender, and subject.

**Related:** [search_emails](#search_emails), [read_email](#read_email)

---

#### `search_emails`

Search emails using himalaya filter syntax.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | **Yes** | — | Search query in himalaya filter syntax |
| `folder` | string | No | `INBOX` | Folder to search in |
| `account` | string | No | default | Account name |

**Filter syntax:**

| Condition | Example | Description |
|-----------|---------|-------------|
| `subject` | `subject invoice` | Subject contains "invoice" |
| `from` | `from alice` | Sender contains "alice" |
| `to` | `to team` | Recipient contains "team" |
| `body` | `body deadline` | Body contains "deadline" |
| `date` | `date 2026-02-13` | Sent on date (exact match) |
| `before` | `before 2026-02-01` | Sent before date |
| `after` | `after 2026-01-01` | Sent after date |
| `flag` | `flag Flagged` | Has specific flag (`Seen`, `Flagged`, `Answered`, `Deleted`, `Draft`) |

**Grammar rules:**

- `and` / `or` are **REQUIRED between every condition pair** — omitting them causes parse errors. `from alice after 2026-07-01` is invalid; use `from alice and after 2026-07-01`.
- `not` negates any condition: `not flag Seen`, `not from spammer`, `not body spam`.
- Multi-word values need backslash-escaped spaces: `subject quarterly\ report`.
- Bare words default to subject-only search; use `body <word>` for body text.
- Sort results with `order by <date|from|to|subject> <asc|desc>`: `order by date desc`.

**Bare-word normalization:** single-word queries without a condition are automatically wrapped with `subject` (e.g. `toilet` → `subject toilet`), since himalaya's parser chokes on unqualified terms. Qualified, multi-word, and operator-containing queries pass through unchanged.

**Examples:**

```
"Find emails about invoices"
→ search_emails(query: "subject invoice")

"Emails from Alice about the meeting"
→ search_emails(query: "from alice and subject meeting")

"Unread emails from last week"
→ search_emails(query: "not flag Seen and after 2026-02-06")

"Search Sent folder for budget emails"
→ search_emails(query: "subject budget", folder: "Sent")

"Latest invoices, newest first"
→ search_emails(query: "subject invoice and after 2026-01-01 order by date desc")
```

**Related:** [list_emails](#list_emails), [read_email](#read_email)

---

#### `get_unread_count`

Get the number of unread emails in a folder. Uses himalaya's server-side filter (`not flag Seen`) for fast counting even in large mailboxes.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `folder` | string | No | `INBOX` | Folder name |
| `account` | string | No | default | Account name |

**Examples:**

```
"How many unread emails do I have?"
→ get_unread_count()

"Unread count in my work inbox"
→ get_unread_count(account: "work")

"Check for unread in Archive"
→ get_unread_count(folder: "Archive")
```

**Output:** A plain number.

**Related:** [inbox_check prompt](#inbox_check-prompt), [list_emails](#list_emails)

---

#### `list_starred`

List all flagged/starred emails in a folder. Convenience wrapper over searching with `flag Flagged`. Returns envelopes with flag, subject, sender, and date.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `folder` | string | No | `INBOX` | Folder name |
| `account` | string | No | default | Account name |

**Examples:**

```
"Show my starred emails"
→ list_starred()

"Starred emails from my work account"
→ list_starred(account: "work")
```

**Output:** One line per starred email with ID, sender, subject, and date.

**Related:** [flag_email](#flag_email), [search_emails](#search_emails)

---

### Reading

#### `read_email`

Read an email message body as plain text.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | **Yes** | — | Email message ID (from list or search) |
| `folder` | string | No | `INBOX` | Folder name |
| `account` | string | No | default | Account name |

**Examples:**

```
"Read email 42"
→ read_email(id: "42")

"Read that email from Sent"
→ read_email(id: "15", folder: "Sent")
```

**Related:** [read_email_html](#read_email_html), [list_emails](#list_emails)

---

#### `read_email_html`

Read an email message body as HTML. Useful for formatted emails with tables, images, or rich text.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | **Yes** | — | Email message ID |
| `folder` | string | No | `INBOX` | Folder name |
| `account` | string | No | default | Account name |

**Examples:**

```
"Show the HTML version of email 42"
→ read_email_html(id: "42")

"Read the formatted newsletter"
→ read_email_html(id: "88")
```

**When to use:** Prefer `read_email` for most messages. Use `read_email_html` when the plain text version is empty or poorly formatted (newsletters, marketing emails, HTML-only senders).

**Compatibility:** Works with himalaya v1.2.0+, which removed the old `--html` flag. The tool exports the message and reads its HTML part, so no flag compatibility is needed.

**Related:** [read_email](#read_email)

---

#### `read_email_raw`

Read the raw MIME source of an email. Returns the full, unedited message including all headers. Useful for debugging, email forensics, and .eml export.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | **Yes** | — | Email message ID |
| `folder` | string | No | `INBOX` | Folder name |
| `account` | string | No | default | Account name |

**Examples:**

```
"Show the raw source of email 42"
→ read_email_raw(id: "42")

"Dump raw MIME of the newsletter"
→ read_email_raw(id: "88")
```

**Related:** [read_email](#read_email), [render_email](#render_email)

---

#### `render_email`

Read an email body rendered as clean markdown. For HTML emails, converts to markdown for a clean reading experience. For plain text emails, returns the body as-is.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | **Yes** | — | Email message ID |
| `folder` | string | No | `INBOX` | Folder name |
| `account` | string | No | default | Account name |

**Examples:**

```
"Show email 42 as clean markdown"
→ render_email(id: "42")

"Read the newsletter without HTML clutter"
→ render_email(id: "88")
```

**Related:** [read_email](#read_email), [read_email_html](#read_email_html)

---

### Managing

#### `flag_email`

Add or remove flags on an email.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | **Yes** | — | Email message ID |
| `flags` | string[] | **Yes** | — | Flags to add/remove |
| `action` | `"add"` \| `"remove"` | **Yes** | — | Whether to add or remove flags |
| `folder` | string | No | `INBOX` | Folder name |
| `account` | string | No | default | Account name |

**Available flags:**

| Flag | Meaning |
|------|---------|
| `Seen` | Email has been read |
| `Flagged` | Starred / important |
| `Answered` | Has been replied to |
| `Deleted` | Marked for deletion |
| `Draft` | Is a draft message |

**Examples:**

```
"Star email 42"
→ flag_email(id: "42", flags: ["Flagged"], action: "add")

"Mark emails 10-15 as read"
→ flag_email(id: "10", flags: ["Seen"], action: "add")
   (repeat for each ID)

"Unstar email 42"
→ flag_email(id: "42", flags: ["Flagged"], action: "remove")

"Mark as read and flag important"
→ flag_email(id: "42", flags: ["Seen", "Flagged"], action: "add")
```

**Related:** [move_email](#move_email), [triage_inbox](#triage_inbox-prompt)

---

#### `move_email`

Move an email to a different folder.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | **Yes** | — | Email message ID |
| `target_folder` | string | **Yes** | — | Destination folder name |
| `folder` | string | No | `INBOX` | Source folder name |
| `account` | string | No | default | Account name |

**Common target folders:**

| Folder | Purpose |
|--------|---------|
| `Archive` | Reviewed, no action needed |
| `Trash` | Delete |
| `Spam` | Junk mail |
| `Drafts` | Saved drafts |

!!! note "Folder names are provider-specific"
    Gmail uses `[Gmail]/Trash`, `[Gmail]/Spam`, etc. Fastmail uses `Trash`, `Spam`. Check your folders with the `email://folders` resource.

**Examples:**

```
"Archive email 42"
→ move_email(id: "42", target_folder: "Archive")

"Delete email 10"
→ move_email(id: "10", target_folder: "Trash")

"Move to project folder"
→ move_email(id: "42", target_folder: "Projects/Launch")
```

**Related:** [flag_email](#flag_email), [triage_inbox](#triage_inbox-prompt)

---

### Folders

#### `list_folders`

List all email folders/mailboxes for an account.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `account` | string | No | default | Account name |

**Examples:**

```
"Show my email folders"
→ list_folders()

"List folders on my work account"
→ list_folders(account: "work")
```

**Output:** One line per folder with the folder name and optional description.

**Related:** [create_folder](#create_folder), [delete_folder](#delete_folder), [move_email](#move_email)

---

#### `create_folder`

Create a new email folder/mailbox.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `name` | string | **Yes** | — | Name for the new folder |
| `account` | string | No | default | Account name |

**Examples:**

```
"Create a folder called Projects"
→ create_folder(name: "Projects")

"Make a Receipts folder on my work account"
→ create_folder(name: "Receipts", account: "work")
```

**Related:** [list_folders](#list_folders), [delete_folder](#delete_folder)

---

#### `delete_folder`

Delete an email folder/mailbox. **Safety gate:** requires `confirm=true` to actually delete.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `name` | string | **Yes** | — | Folder name to delete |
| `confirm` | boolean | No | `false` | Set `true` to actually delete |
| `account` | string | No | default | Account name |

**Safety flow:**

```
1. delete_folder(name: "OldStuff")            → PREVIEW warning (not deleted)
2. User reviews and approves
3. delete_folder(name: "OldStuff", confirm: true)  → DELETES
```

!!! danger "Permanent deletion"
    Deleting a folder permanently removes the folder and all emails in it. Always review the preview before confirming.

**Related:** [list_folders](#list_folders), [create_folder](#create_folder)

---

### Compose

#### `compose_email`

Compose and send a new email (not a reply). **Two-phase safety gate:** requires explicit `confirm=true`.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `to` | string | **Yes** | — | Recipient email address |
| `subject` | string | **Yes** | — | Email subject line |
| `body` | string | **Yes** | — | Email body text |
| `cc` | string | No | — | CC recipient(s) |
| `bcc` | string | No | — | BCC recipient(s) |
| `attachments` | string[] | No | — | Local file paths to attach (e.g. `["/tmp/report.pdf"]`) |
| `confirm` | boolean | No | `false` | Set `true` to actually send |
| `account` | string | No | default | Account name |

**Safety flow:**

```
1. compose_email(to: "alice@example.com", subject: "Meeting", body: "...")
   → shows PREVIEW (not sent)
2. User reviews and approves
3. compose_email(..., confirm: true)  → SENDS
```

**Examples:**

```
"Send Alice an email about the meeting"
→ compose_email(to: "alice@example.com", subject: "Meeting Request", body: "Hi Alice...")

"Email the team about the deadline"
→ compose_email(to: "team@example.com", subject: "Q2 Deadline Reminder", body: "...")

"Send Alice the Q1 report PDF"
→ compose_email(to: "alice@example.com", subject: "Q1 Report", body: "See attached.",
                attachments: ["/Users/me/Downloads/q1-report.pdf"])
```

!!! danger "Never skip the preview step"
    Always call `compose_email` without `confirm` first to show the preview. Only set `confirm=true` after the user explicitly approves.

**Related:** [draft_reply](#draft_reply), [send_email](#send_email)

---

### Actions

#### `export_to_markdown`

Export an email as formatted markdown with YAML frontmatter.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | **Yes** | — | Email message ID |
| `folder` | string | No | `INBOX` | Folder name |
| `account` | string | No | default | Account name |

**Output format:**

```yaml
---
subject: "Meeting Notes - Q1 Review"
from: "Alice <alice@example.com>"
to: "Team <team@example.com>"
date: "2026-02-13"
id: "42"
flags: [Seen, Flagged]
has_attachment: false
---

# Meeting Notes - Q1 Review

[email body in plain text]
```

**Examples:**

```
"Export email 42 to markdown"
→ export_to_markdown(id: "42")

"Save this email for my notes"
→ export_to_markdown(id: "42")
   then copy_to_clipboard or save to file
```

**Related:** [copy_to_clipboard](#copy_to_clipboard), [read_email](#read_email)

---

#### `create_action_item`

Extract action items, todos, deadlines, and commitments from an email.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | **Yes** | — | Email message ID |
| `folder` | string | No | `INBOX` | Folder name |
| `account` | string | No | default | Account name |

**Output identifies:**

- Action items / tasks
- Deadlines or due dates
- Commitments made by sender
- Questions that need answers
- Meetings or events mentioned

**Examples:**

```
"What do I need to do from email 42?"
→ create_action_item(id: "42")

"Extract todos from the project update"
→ create_action_item(id: "88")
```

**Related:** [triage_inbox](#triage_inbox-prompt), [summarize_email](#summarize_email-prompt)

---

### Replies & Sending

#### `draft_reply`

Generate a reply template for an email. Does **not** send.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | **Yes** | — | Email message ID to reply to |
| `body` | string | No | — | Custom reply body text |
| `reply_all` | boolean | No | `false` | Reply to all recipients |
| `folder` | string | No | `INBOX` | Folder name |
| `account` | string | No | default | Account name |

**Examples:**

```
"Draft a reply to email 42"
→ draft_reply(id: "42")

"Reply all with my availability"
→ draft_reply(id: "42", body: "I'm available Tuesday afternoon.", reply_all: true)
```

!!! warning "This tool creates a draft only"
    The reply is **not sent**. Use [send_email](#send_email) with `confirm=true` after reviewing.

**Related:** [send_email](#send_email), [draft_reply prompt](#draft_reply-prompt)

---

#### `send_email`

Send an email template. **Two-phase safety gate:** requires explicit `confirm=true`.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `template` | string | **Yes** | — | Full email template (MML format from draft_reply) |
| `attachments` | string[] | No | — | Local file paths to attach (e.g. `["/tmp/report.pdf"]`) |
| `confirm` | boolean | No | `false` | Set `true` to actually send |
| `account` | string | No | default | Account name |

**Safety flow:**

```
1. draft_reply(id: "42")           → generates template
2. send_email(template: "...")     → shows PREVIEW (not sent)
3. User reviews and approves
4. send_email(template: "...", confirm: true)  → SENDS
```

To attach local files, pass `attachments` before confirming. The attachment MML is injected into the template and visible in the preview:

```
send_email(template: "...", attachments: ["/tmp/report.pdf"])     → PREVIEW with attachment shown
send_email(template: "...", attachments: ["/tmp/report.pdf"], confirm: true)  → SENDS with attachment
```

!!! danger "Never skip the preview step"
    Always call `send_email` without `confirm` first to show the preview. Only set `confirm=true` after the user explicitly approves.

**Related:** [draft_reply](#draft_reply)

---

### Adapters

#### `copy_to_clipboard`

Copy text to the system clipboard (macOS `pbcopy`).

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `text` | string | **Yes** | — | Text to copy |

**Examples:**

```
"Copy that email to my clipboard"
→ export_to_markdown(id: "42")
   then copy_to_clipboard(text: <markdown output>)

"Copy the sender's email address"
→ copy_to_clipboard(text: "alice@example.com")
```

---

### Attachments

#### `list_attachments`

List all attachments in an email message. Downloads all attachments to inspect them, returning filename, MIME type (inferred from extension), and file size for each.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | **Yes** | — | Email message ID |
| `folder` | string | No | `INBOX` | Folder name |
| `account` | string | No | default | Account name |

**Examples:**

```
"What attachments does email 42 have?"
→ list_attachments(id: "42")

"Check attachments in the project email"
→ list_attachments(id: "88")
```

**Output:** One line per attachment with filename, MIME type, and size in KB.

!!! note "Body parts are filtered"
    himalaya downloads all message parts including `plain.txt` and `index.html` body parts. These are automatically excluded from the attachment list.

**Related:** [download_attachment](#download_attachment), [extract_calendar_event](#extract_calendar_event)

---

#### `download_attachment`

Download a specific attachment from an email to a temporary directory.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | **Yes** | — | Email message ID |
| `filename` | string | **Yes** | — | Attachment filename to download |
| `folder` | string | No | `INBOX` | Folder name |
| `account` | string | No | default | Account name |

**Examples:**

```
"Download the PDF from email 42"
→ download_attachment(id: "42", filename: "report.pdf")

"Get the spreadsheet attachment"
→ download_attachment(id: "88", filename: "budget.xlsx")
```

**Output:** File path where the attachment was saved (temp directory).

**Typical workflow:**

```
1. list_attachments(id: "42")    → see available files
2. download_attachment(id: "42", filename: "report.pdf")  → get file path
```

**Related:** [list_attachments](#list_attachments)

---

### Calendar

#### `extract_calendar_event`

Extract calendar event details from an email's ICS attachment. Downloads all attachments, finds the `.ics` file, parses it, and returns event summary, dates, location, and organizer.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | **Yes** | — | Email message ID containing the calendar invite |
| `folder` | string | No | `INBOX` | Folder name |
| `account` | string | No | default | Account name |

**Examples:**

```
"What's in the meeting invite in email 42?"
→ extract_calendar_event(id: "42")

"Parse the calendar attachment"
→ extract_calendar_event(id: "88")
```

**Output:** Event title, start/end times, location, organizer, and description.

**Related:** [create_calendar_event](#create_calendar_event), [list_attachments](#list_attachments)

---

#### `create_calendar_event`

Create an event in Apple Calendar. **Safety gate:** requires `confirm=true` to actually create. macOS only.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `summary` | string | **Yes** | — | Event title/summary |
| `dtstart` | string | **Yes** | — | Start date/time (ISO format) |
| `dtend` | string | **Yes** | — | End date/time (ISO format) |
| `location` | string | No | — | Event location |
| `description` | string | No | — | Event description/notes |
| `confirm` | boolean | No | `false` | Set `true` to actually create |

**Safety flow:**

```
1. extract_calendar_event(id: "42")    → parse ICS attachment
2. create_calendar_event(summary: "...", dtstart: "...", dtend: "...")
   → shows PREVIEW (not created)
3. User reviews and approves
4. create_calendar_event(..., confirm: true)  → CREATES in Apple Calendar
```

**Examples:**

```
"Add that meeting to my calendar"
→ extract_calendar_event(id: "42")
   then create_calendar_event(summary: "Team Standup", dtstart: "2026-03-01T09:00:00", ...)

"Create a calendar event for Friday at 2pm"
→ create_calendar_event(summary: "Project Review", dtstart: "2026-02-20T14:00:00", dtend: "2026-02-20T15:00:00")
```

!!! warning "macOS only"
    Calendar event creation uses AppleScript to interact with Apple Calendar. This tool is only available on macOS.

**Related:** [extract_calendar_event](#extract_calendar_event)

---

### Threads

#### `list_threads` {#list_threads}

List email threads (conversations) grouped by subject line. Strips `Re:`, `Fwd:`, `RE:`, `FW:` prefixes to normalize subjects.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `folder` | string | No | `INBOX` | Folder to list threads from |
| `page_size` | number | No | `50` | Number of envelopes to group |
| `account` | string | No | default | Account name |

**Examples:**

```
"Show my email conversations"
→ list_threads()

"List threads in my work inbox"
→ list_threads(folder: "Work", account: "work")
```

**Related:** [read_thread](#read_thread), [list_emails](#list_emails)

---

#### `read_thread` {#read_thread}

Read all messages in a thread chronologically, showing sender, date, and message body for each.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `thread_id` | string | **Yes** | — | Thread identifier (normalized subject) |
| `folder` | string | No | `INBOX` | Folder to search |
| `account` | string | No | default | Account name |

**Examples:**

```
"Show me the full project kickoff thread"
→ read_thread(thread_id: "Project kickoff")

"Read the conversation about budget review"
→ read_thread(thread_id: "Budget review")
```

**Related:** [list_threads](#list_threads)

---

### Snooze

#### `snooze_email`

Snooze an email until a specified time. The email reappears in your inbox check after the snooze period expires.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | **Yes** | — | Email message ID to snooze |
| `snoozeUntil` | string | **Yes** | — | When to unsnooze — ISO (`2026-07-08T09:00:00`) or shorthand (`2h`, `1d`, `tomorrow`, `monday`) |
| `subject` | string | No | — | Email subject, for display in the snooze list |
| `folder` | string | No | `INBOX` | Folder name |
| `account` | string | No | default | Account name |

**Examples:**

```
"Snooze email 42 until tomorrow"
→ snooze_email(id: "42", snoozeUntil: "tomorrow")

"Hide this until Monday"
→ snooze_email(id: "42", snoozeUntil: "monday")

"Snooze for 2 hours"
→ snooze_email(id: "42", snoozeUntil: "2h")
```

**Related:** [list_snoozed_emails](#list_snoozed_emails), [inbox_check](#inbox_check-prompt)

---

#### `list_snoozed_emails`

List all snoozed emails and their unsnooze times. Emails past their snooze time are returned as expired and can be revisited.

Takes no parameters.

**Examples:**

```
"What have I snoozed?"
→ list_snoozed_emails()

"Anything due to come back?"
→ list_snoozed_emails()
```

**Related:** [snooze_email](#snooze_email)

---

### Reminders

#### `create_reminder`

Create a reminder in Apple Reminders. Use for action items, follow-ups, and tasks extracted from email.

!!! note "macOS only"
    Backed by `osascript`. On other platforms the tool returns a structured error.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `title` | string | **Yes** | — | Reminder title / task description |
| `notes` | string | No | — | Notes or context for the reminder |
| `dueDate` | string | No | — | Due date, ISO format (`2026-07-15T14:00:00`) |
| `priority` | number | No | — | Priority 1–5 (1 = highest) |

**Examples:**

```
"Remind me to reply to Sarah tomorrow at 2pm"
→ create_reminder(title: "Reply to Sarah", dueDate: "2026-07-15T14:00:00")

"Add the action item from email 42 to my reminders"
→ create_action_item(id: "42") then create_reminder(title: ..., notes: ...)
```

**Related:** [create_action_item](#create_action_item), [create_calendar_event](#create_calendar_event)

---

### Diagnostics

#### `health_check`

Check himalaya-mcp installation health and per-account IMAP connectivity. Use when an email tool fails, to find which accounts are reachable.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `account` | string | No | all accounts | Specific account to test |

Each account is probed on **two surfaces** — the folder list and an envelope fetch — so a folder failure and an envelope failure are reported separately rather than collapsing into one generic "unreachable". The response carries an `overall` status (`healthy` / `degraded` / `broken`), the detected himalaya version and binary path, and a per-account detail array with a `hint` for each failure.

**Examples:**

```
"Why is my email not working?"
→ health_check()

"Check just the work account"
→ health_check(account: "work")
```

**Related:** [Diagnose issues](../getting-started/diagnose-issues.md), [Troubleshooting](../guide/troubleshooting.md)

---

## Prompts

### `triage_inbox` {#triage_inbox-prompt}

Classify recent emails as actionable, FYI, or skip.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `count` | string | No | `"10"` | Number of recent emails to triage |

**What it does:**

1. Fetches recent emails with `list_emails`
2. Reads each with `read_email`
3. Classifies as **Actionable** / **FYI** / **Skip**
4. Suggests flags and folder moves
5. Presents a table for your approval
6. Executes only actions you confirm

**Example output:**

| ID | From | Subject | Class | Suggested Action |
|----|------|---------|-------|------------------|
| 42 | Alice | Q1 Review | Actionable | Flag, reply needed |
| 43 | Newsletter | Weekly digest | Skip | Archive |
| 44 | Bob | FYI: server update | FYI | Mark read |

---

### `summarize_email` {#summarize_email-prompt}

One-sentence summary with action items for a specific email.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | **Yes** | — | Email message ID |
| `folder` | string | No | `INBOX` | Folder name |

**Output includes:**

- One-sentence summary
- Action items (or "None")
- Priority: High / Medium / Low
- Suggested response (if actionable)

---

### `daily_email_digest`

Create a markdown digest of today's emails grouped by priority.

*No parameters.*

**Output format:**

```markdown
# Email Digest - 2026-02-13

## Requires Action
- **Q1 Review** from Alice - needs response by Friday

## FYI / Review
- **Server Update** from Bob - maintenance window tonight

## Low Priority
- **Weekly Newsletter** from Devtools - new releases

## Stats
- Total: 15 emails
- Action needed: 3
- FYI: 7
- Low priority: 5
```

---

### `draft_reply` (prompt) {#draft_reply-prompt}

Guided reply composition with tone control.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | **Yes** | — | Email message ID to reply to |
| `tone` | string | No | `"professional"` | Tone: professional, casual, brief, detailed |
| `instructions` | string | No | — | Specific instructions for reply content |

**Examples:**

```
"Reply professionally to email 42"
→ draft_reply prompt (id: "42", tone: "professional")

"Send a brief casual reply declining the meeting"
→ draft_reply prompt (id: "42", tone: "casual", instructions: "Decline politely, suggest next week")
```

!!! note "Prompt vs Tool"
    The **prompt** `draft_reply` guides the full workflow (read, draft, review, send). The **tool** `draft_reply` just generates the template. Use the prompt for interactive reply sessions.

---

### `morning_briefing` {#morning_briefing-prompt}

Morning email briefing with urgency classification. Guides Claude to classify emails into categories: **Needs Reply Today**, **FYI**, and **Newsletter/Promo**, then extract calendar events and identify action items.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `account` | string | No | default | Account name |

**Examples:**

```
"Give me my morning email briefing"
→ morning_briefing prompt

"Morning briefing for my work account"
→ morning_briefing prompt (account: "work")
```

---

### `inbox_check` {#inbox_check-prompt}

Quick inbox status check with unread count, highlights, and suggested next actions.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `folder` | string | No | `INBOX` | Folder to check |
| `account` | string | No | default | Account name |

**Examples:**

```
"Quick check on my inbox"
→ inbox_check prompt

"Check my Sent folder"
→ inbox_check prompt (folder: "Sent")
```

---

## Resources

### `email://inbox`

Browse current inbox listing. Returns recent emails as a read-only resource.

```
URI: email://inbox
Type: text/plain
```

### `email://folders`

List available email folders for the current account.

```
URI: email://folders
Type: text/plain
```

### `email://message/{id}`

Read a specific email message by ID.

```
URI: email://message/42
Type: text/plain
```

---

## Common Parameters

These parameters appear on most tools:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `folder` | Email folder (default: INBOX) | `"Archive"`, `"Sent"`, `"[Gmail]/Trash"` |
| `account` | himalaya account name | `"personal"`, `"work"` |
| `id` | Email message ID from list/search results | `"42"`, `"1337"` |

!!! tip "Multi-account usage"
    Every tool accepts an optional `account` parameter. If omitted, himalaya uses your default account. Set up multiple accounts in `~/.config/himalaya/config.toml`.

---

!!! tip "See also"
    **[CLI Reference](cli.md)** for CLI commands (`doctor`, `setup`, `install-ext`, `remove-ext`, `--help`, `--version`).
