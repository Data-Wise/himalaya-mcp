# Tutorial: Migrating from `em` to himalaya-mcp

If you're coming from flow-cli's `em` email dispatcher, this tutorial translates your existing terminal workflow into natural-language prompts for Claude.

**Time:** 10 minutes | **Prerequisites:** himalaya-mcp installed and configured

---

## Step 1: The Dashboard

**Old way:** `em` (no arguments)

**New way:** "Claude, check my inbox"

Claude calls `list_emails(page_size: 10)` and shows your recent messages with sender, subject, and date. The `inbox_check` prompt also shows unread count and highlights.

## Step 2: Reading Email

**Old way:** `em read 42` or just `em 42`

**New way:** "Claude, read email 42"

Claude calls `read_email(id: "42")` and shows the plain text body.

**HTML version:**
- Old: `em read --html 42`
- New: "Show the HTML version of email 42"

**Markdown version:**
- Old: `em read --md 42`
- New: "Show email 42 as clean markdown" (uses `render_email`)

**Raw source:**
- Old: `em read --raw 42`
- New: "Show the raw source of email 42" (uses `read_email_raw`)

## Step 3: Listing Emails

**Old way:** `em inbox 5` or `em -n 5`

**New way:** "List my last 5 emails"

Claude calls `list_emails(page_size: 5)`.

## Step 4: Searching

**Old way:** `em find "from alice and subject meeting"`

**New way:** "Search emails from Alice about the meeting"

Claude calls `search_emails(query: "from alice and subject meeting")`.

## Step 5: Replying

**Old way:** `em reply 42`

**New way:** "Reply to email 42 saying I'll be there at 2pm"

Claude calls `draft_reply(id: "42")` to generate a draft, shows it to you, then calls `send_email(confirm: true)` after you approve.

## Step 6: Composing

**Old way:** `em send`

**New way:** "Send Alice an email about Q1 review"

Claude calls `compose_email(to: "alice@example.com", subject: "Q1 Review", body: "...")` to show a preview, then sends after you confirm.

**With attachments:**
- Old: `em send` (adds via editor)
- New: "Send Alice the report.pdf from my Desktop" — Claude adds `attachments: ["/path/to/report.pdf"]`

## Step 7: Managing Flags

| Action | Old way | New way |
|--------|---------|---------|
| Star an email | `em star 42` | "Star email 42" |
| Unstar | `em unflag 42` | "Unstar email 42" |
| List starred | `em starred` | "Show my starred emails" |
| Mark as read | `em flag 42 --add Seen` | "Mark email 42 as read" |

## Step 8: Moving and Deleting

| Action | Old way | New way |
|--------|---------|---------|
| Move to folder | `em move 42 Archive` | "Move email 42 to Archive" |
| Delete (trash) | `em delete 42` | "Delete email 42" |
| Restore from trash | `em restore 42` | "Restore email 42 from trash" |

## Step 9: Unread Count

**Old way:** `em unread`

**New way:** "How many unread emails do I have?"

Alternatively: "Check my work inbox for unread" scopes to a specific account.

## Step 10: Folders

| Action | Old way | New way |
|--------|---------|---------|
| List folders | `em folders` | "List my folders" |
| Create folder | `em create-folder Projects` | "Create a folder called Projects" |
| Delete folder | `em delete-folder OldStuff` | "Delete the OldStuff folder" |

## Step 11: Attachments

| Action | Old way | New way |
|--------|---------|---------|
| List attachments | `em attach list 42` | "What attachments does email 42 have?" |
| Download one | `em attach get 42 report.pdf` | "Download the PDF from email 42" |

## Step 12: Calendar

**Old way:** `em calendar 42`

**New way:** "Extract the calendar invite from email 90"

Then: "Add this event to my calendar" (calls `create_calendar_event` with review and confirm).

## Step 13: Digest

| Digest | Old way | New way |
|--------|---------|---------|
| Daily | `em digest` | "Give me a daily email digest" |
| Weekly | `em digest --week` | "Give me a weekly email digest" |

## Step 14: Snoozing

| Action | Old way | New way |
|--------|---------|---------|
| Snooze | `em snooze 42 2h` | "Snooze email 42 for 2 hours" |
| Snooze until tomorrow | `em snooze 42 tomorrow` | "Snooze email 42 until tomorrow" |
| List snoozed | `em snoozed` | "Show my snoozed emails" |

## Step 15: Batch Replies

**Old way:** `em respond`

**New way:** "Draft replies for all my actionable emails" (`/email:respond`)

Claude generates drafts for each actionable email, presents a summary, and lets you approve individually.

## Step 16: Health Check

**Old way:** `em doctor`

**New way:**
- "Run a health check on my email accounts" (MCP `health_check` tool)
- `himalaya-mcp doctor` (CLI — full-stack diagnostics)

## Summary

Your `em` workflow translates naturally. Instead of `em <command> <args>`, you tell Claude what you want in plain English. The underlying himalaya CLI is the same, so all your accounts and config work identically.
