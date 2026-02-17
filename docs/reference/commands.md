# Command Reference

Complete reference for all 19 MCP tools, 4 prompts, 3 resources, and CLI commands.

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
| `date` | `date 2026-02-13` | Sent on date |
| `before` | `before 2026-02-01` | Sent before date |
| `after` | `after 2026-01-01` | Sent after date |
| `flag` | `flag Flagged` | Has specific flag |

**Operators:** `and`, `or`, `not`

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
```

**Related:** [list_emails](#list_emails), [read_email](#read_email)

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

**Related:** [read_email](#read_email)

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
| `confirm` | boolean | No | `false` | Set `true` to actually send |
| `account` | string | No | default | Account name |

**Safety flow:**

```
1. draft_reply(id: "42")           → generates template
2. send_email(template: "...")     → shows PREVIEW (not sent)
3. User reviews and approves
4. send_email(template: "...", confirm: true)  → SENDS
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

## CLI Commands

### `himalaya-mcp setup`

Configure himalaya-mcp as an MCP server for Claude Desktop (legacy `mcpServers` approach).

```bash
himalaya-mcp setup           # Add MCP server to Claude Desktop config
himalaya-mcp setup --check   # Verify configuration exists and paths are valid
himalaya-mcp setup --remove  # Remove the server entry
```

**Config path (per platform):**

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%/Claude/claude_desktop_config.json` |

The setup command preserves all existing MCP servers in the config file. Only the `himalaya` entry is added, updated, or removed.

---

### `himalaya-mcp install-ext`

Install a `.mcpb` Desktop Extension into Claude Desktop.

```bash
himalaya-mcp install-ext                              # Auto-find .mcpb in project root
himalaya-mcp install-ext himalaya-mcp-v1.2.1.mcpb     # Install specific file
```

**What it does:**

1. Unpacks the `.mcpb` to `~/Library/Application Support/Claude/Claude Extensions/himalaya-mcp/`
2. Registers the extension in `extensions-installations.json` with SHA256 hash
3. Creates default settings (enabled, empty user config)
4. Restart Claude Desktop to activate

**Auto-discovery:** If no file path is given, searches the project root for `himalaya-mcp-v*.mcpb` and picks the latest version.

!!! tip "When to use"
    Use `install-ext` for local development and testing. For production installs, download the `.mcpb` from [GitHub Releases](https://github.com/Data-Wise/himalaya-mcp/releases) and double-click to install via Claude Desktop's GUI.

---

### `himalaya-mcp remove-ext`

Remove the himalaya-mcp Desktop Extension from Claude Desktop.

```bash
himalaya-mcp remove-ext
```

**What it removes:**

- Extension directory (`Claude Extensions/himalaya-mcp/`)
- Registry entry from `extensions-installations.json`
- Settings file (`Claude Extensions Settings/himalaya-mcp.json`)

Restart Claude Desktop after removal.

!!! note "See also"
    **[Desktop Extensions Reference](desktop-extensions.md)** for full details on the `.mcpb` format, manifest schema, and installation mechanism.
