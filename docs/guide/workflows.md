# Email Workflows

Common patterns for using himalaya-mcp with Claude.

## 1. Morning Inbox Triage

The most common workflow -- review and organize your inbox.

**Natural language:** "Triage my inbox"

**What happens:**

1. `list_emails(page_size: 20)` -- fetch recent emails
2. `read_email` on each -- understand content
3. Classify as **Actionable** / **FYI** / **Skip**
4. Present table with suggested actions
5. Wait for your approval before any flags or moves

**Example interaction:**

```
You: "Triage my inbox"

Claude:
| ID     | From           | Subject              | Class      | Action          |
|--------|----------------|----------------------|------------|-----------------|
| 249088 | alice@work.com | Q1 Budget Review     | Actionable | Reply needed    |
| 249064 | newsletter@... | Weekly Digest        | Skip       | Move to Archive |
| 249051 | boss@work.com  | Meeting Tomorrow     | Actionable | Flag + Reply    |

Want me to flag #249088 and #249051, and archive #249064?
```

## 2. Reply to an Email

Draft and send a reply with safety confirmation.

**Natural language:** "Reply to email 249088"

**What happens:**

1. `read_email(id: "249088")` -- understand original
2. `draft_reply(id: "249088")` -- generate reply template
3. Show full draft for review
4. Wait for approval or edits
5. `send_email(template, confirm: true)` only after explicit "send it"

**Key safety points:**
- Draft is shown before anything is sent
- You can say "make it more formal" or "add that I'll be late"
- Claude revises and shows again
- Only "send" / "yes" / "looks good" triggers actual send

## 3. Daily Email Digest

Get a priority-grouped summary of today's email.

**Natural language:** "Give me today's email digest"

**What happens:**

1. `list_emails(page_size: 50)` -- fetch recent emails
2. `read_email` on each for content understanding
3. Group by priority: Action Required / FYI / Low Priority
4. Generate markdown digest with one-line summaries
5. Offer to export or copy to clipboard

**Output format:**

```markdown
# Email Digest -- 2026-02-13

## Requires Action
- **Q1 Budget Review** from Alice -- needs approval by Friday

## FYI / Review
- **Sprint Retrospective Notes** from Bob -- action items from yesterday

## Low Priority
- **Weekly Newsletter** from DevNews -- this week's highlights

Stats: 12 emails | 2 action | 4 FYI | 6 low
```

## 4. Export Email to Markdown

Save an email as a structured markdown file.

**Natural language:** "Export email 249088 as markdown"

**What happens:**

1. `export_to_markdown(id: "249088")` -- generates markdown with YAML frontmatter
2. Returns formatted text you can save or pipe

**Output:**

```markdown
---
subject: "Q1 Budget Review"
from: "Alice <alice@work.com>"
to: "You <you@work.com>"
date: "2026-02-13T09:15:00Z"
id: "249088"
flags: [Seen, Flagged]
has_attachment: true
---

# Q1 Budget Review

Hi team, please review the attached budget...
```

## 5. Extract Action Items

Pull todos and deadlines from an email.

**Natural language:** "What are the action items in email 249088?"

**What happens:**

1. `create_action_item(id: "249088")` -- fetches email with context
2. Claude identifies tasks, deadlines, questions, and commitments

**Output:**

```
Action items from "Q1 Budget Review" (Alice, 2026-02-13):

- [ ] Review budget spreadsheet (attached)
- [ ] Submit feedback by Friday 2026-02-14
- [ ] Schedule follow-up meeting for next week
```

## 6. Multi-Account Workflow

Work across email accounts in a single session.

**Natural language:** "Check my work inbox, then my personal"

```
list_emails(account: "work")       -- work inbox
list_emails(account: "personal")   -- personal inbox
```

Set a default account via `HIMALAYA_ACCOUNT` env var, then override per-call.

## 7. Search and Process

Find specific emails and act on them.

**Natural language:** "Find all emails from alice about the budget"

```
search_emails(query: "from:alice subject:budget")
  -> read_email on results
  -> summarize, reply, export, or extract actions
```

Search supports himalaya's filter syntax: `from:`, `subject:`, `body:`, `before:`, `after:`.

## 8. Batch Flag/Move

Organize multiple emails at once.

**Natural language:** "Mark all newsletters as read and archive them"

```
search_emails(query: "from:newsletter")
  -> flag_email(id, flags: ["Seen"], action: "add")  -- for each
  -> move_email(id, target_folder: "Archive")         -- for each
```

The email-assistant agent asks for confirmation before bulk operations on 5+ emails.

## 9. Newsletter Cleanup

Bulk archive newsletters and promotional emails.

**Natural language:** "Clean up my newsletters from the past week"

**What happens:**

1. `search_emails(query: "after 2026-02-06")` -- recent emails
2. Claude identifies newsletters by sender patterns
3. Presents list for confirmation
4. `flag_email(id, flags: ["Seen"], action: "add")` -- mark read
5. `move_email(id, target_folder: "Archive")` -- archive each

**Tip:** Combine with triage for efficiency:

```
You: "Triage my inbox, but auto-archive anything from
      newsletters or marketing"
```

## 10. Meeting Preparation

Pull relevant emails before a meeting.

**Natural language:** "Find all emails about the Q1 review meeting"

**What happens:**

1. `search_emails(query: "subject Q1 review")` -- find related emails
2. `read_email` on each -- gather context
3. `create_action_item` on each -- extract todos and deadlines
4. Claude summarizes all relevant context

**Example:**

```
You: "I have a meeting with Alice about Q1 budget. Gather all
      relevant emails and action items."

Claude:
Found 4 emails about Q1 budget:

Email threads:
1. Alice: Q1 Budget Review (Feb 13) -- initial review request
2. Alice: Budget Spreadsheet Updated (Feb 10) -- revised numbers
3. Bob: Q1 Projections (Feb 8) -- engineering estimates
4. Alice: Budget Meeting Agenda (Feb 7) -- meeting prep

Action items:
- [ ] Review marketing line item variance
- [ ] Prepare engineering allocation proposal
- [ ] Bring Q4 actuals for comparison

Want me to export this as markdown for your notes?
```

## 11. Email-to-Notes Pipeline

Convert important emails into structured notes.

**Natural language:** "Save the project update email to my notes"

**What happens:**

1. `read_email(id)` -- get content
2. `export_to_markdown(id)` -- convert with YAML frontmatter
3. `create_action_item(id)` -- extract tasks
4. `copy_to_clipboard(text)` -- ready to paste into Obsidian, Notion, etc.

**Combined output:**

```
You: "Export email 42 with action items and copy everything"

Claude exports:
---
subject: "Project Alpha Update"
from: "pm@company.com"
date: "2026-02-13"
---

# Project Alpha Update

[email body]

## Action Items
- [ ] Review updated timeline by Wednesday
- [ ] Schedule stakeholder demo for next week

Copied to clipboard.
```

## 12. Compose a New Email

Send a new email (not a reply) with safety confirmation.

**Natural language:** "Email alice@example.com about the project deadline"

**What happens:**

1. `compose_email(to, subject, body)` -- generates preview (not sent)
2. Show full preview for review
3. Wait for approval or edits
4. `compose_email(..., confirm: true)` only after explicit approval

**Example interaction:**

```
You: "Email the team about moving the deadline to Friday"

Claude:
--- EMAIL PREVIEW (not sent) ---

To: team@work.com
Subject: Deadline Moved to Friday

Hi team,

Quick update -- the project deadline has been moved to Friday.
Please adjust your timelines accordingly.

Let me know if you have any questions.

--- END PREVIEW ---

Send this, edit it, or cancel?
```

**Tip:** Add CC/BCC: "Email Alice, CC Bob about the meeting change"

## 13. Download and Process Attachments

View and download email attachments.

**Natural language:** "What attachments does email 42 have?"

**What happens:**

1. `list_attachments(id: "42")` -- shows files with MIME types and sizes
2. Choose which to download
3. `download_attachment(id: "42", filename: "report.pdf")` -- saves to temp dir

```
You: "Download the report from email 42"

Claude:
Attachments for email 42:
- report.pdf (application/pdf, 245 KB)
- invite.ics (text/calendar, 2 KB)

Downloaded "report.pdf" to: /tmp/himalaya-mcp-abc123/report.pdf
```

**Note:** Body parts (`plain.txt`, `index.html`) are automatically filtered out.

## 14. Process Calendar Invites

Extract meeting details from ICS attachments and add to Apple Calendar.

**Natural language:** "Check the meeting invite in email 42"

**What happens:**

1. `extract_calendar_event(id: "42")` -- downloads attachments, finds `.ics`, parses it
2. Shows event details: title, dates, location, organizer
3. If you want to add to calendar:
4. `create_calendar_event(...)` -- shows preview first (safety gate)
5. `create_calendar_event(..., confirm: true)` -- creates in Apple Calendar

```
You: "Add the meeting from email 42 to my calendar"

Claude:
Event: Q2 Planning Meeting
Start: 2026-03-01 14:00
End: 2026-03-01 15:00
Location: Room 42
Organizer: alice@example.com

Create this event in Apple Calendar?
```

**Note:** Calendar creation is macOS only (uses AppleScript).

## 15. Folder Management

Create and organize email folders.

**Natural language:** "Create a Projects folder for my work account"

```
create_folder(name: "Projects", account: "work")  -- create
list_folders(account: "work")                       -- verify
move_email(id: "42", target_folder: "Projects")     -- use it
```

**Delete with safety gate:**

```
You: "Delete the OldStuff folder"

Claude:
--- DELETE FOLDER PREVIEW ---
Folder to delete: OldStuff
WARNING: This will permanently delete the folder and all emails in it.
---

Are you sure? This action cannot be undone.
```

## 16. End-of-Day Email Sweep

Quick cleanup before signing off. Now includes attachment checks and calendar event extraction.

**Natural language:** "Do an end-of-day email sweep"

**What happens:**

1. `list_emails(page_size: 30)` -- today's emails
2. Claude identifies unread and unflagged items
3. Quick classification: reply tomorrow / archive / ignore
4. Generates a "tomorrow morning" action list

**Example:**

```
You: "End-of-day sweep"

Claude:
Today's email summary:
- 23 emails received
- 18 already handled
- 5 remaining:

| ID     | From    | Subject           | Suggested      |
|--------|---------|-------------------|----------------|
| 249102 | Client  | Contract question | Reply tomorrow |
| 249098 | Boss    | FYI: new hire     | Mark read      |
| 249095 | DevOps  | Deploy complete   | Archive        |
| 249091 | HR      | Survey reminder   | Archive        |
| 249089 | Alice   | Quick question    | Reply tomorrow |

Tomorrow's priority list:
1. Reply to Client re: contract question
2. Reply to Alice re: quick question

Mark the other 3 as read and archive?
```

## 17. Search and Filter Emails

Use the `/email:search` skill for powerful email search with filter combinations.

**Natural language:** "Find unread emails from Alice about the budget"

**What happens:**

1. `/email:search` parses your query into himalaya filter syntax
2. `search_emails(query: "from alice and subject budget and not flag Seen")` -- combined filters
3. Results displayed as a table with ID, From, Subject, Date, Flags
4. Offers to read, triage, or act on results

**Filter combinations:**

```
Keyword only:     "search meeting"         → subject meeting or body meeting
Sender filter:    "search from:alice"      → from alice
Flag filter:      "search --unread"        → not flag Seen
Date filter:      "find emails from last week" → after 2026-02-19
Combined:         "search from:alice --unread meeting" → from alice and not flag Seen and subject meeting
```

**Example interaction:**

```
You: "Find unread emails from Alice"

Claude:
Search: "from alice, unread" (3 results)

| # | From              | Subject              | Date       | Flags |
|---|-------------------|----------------------|------------|-------|
| 1 | alice@work.com    | Q2 Planning          | Feb 25     |       |
| 2 | alice@work.com    | Budget Revision      | Feb 24     |       |
| 3 | alice@work.com    | Meeting Notes        | Feb 23     |       |

→ "Read #1" to view full email
→ "Flag all" to star these
→ "/email:manage archive 1,2,3" to bulk archive
```

## 18. Bulk Email Management

Use `/email:manage` for batch operations on multiple emails.

**Natural language:** "Move emails 1, 2, 5 to Archive"

**What happens:**

1. `/email:manage` parses the action and target list
2. Shows confirmation gate for operations on >5 emails
3. Executes operations with progress display
4. Shows summary

**Batch patterns:**

```
Flag specific:    /email:manage flag 1,2,5
Unflag:           /email:manage unflag 3,7
Move to folder:   /email:manage move 1,2,3 Archive
Archive shortcut: /email:manage archive 4,5,6
All unread:       /email:manage move all-unread Spam
```

**Example interaction:**

```
You: "Archive all the newsletter emails"

Claude:
Found 8 newsletter emails.

WARNING: This will move 8 emails to Archive. Continue? (yes/no)

You: "yes"

[1/8] Moving email #249064 to Archive...
[2/8] Moving email #249058 to Archive...
...
[8/8] Moving email #249012 to Archive...

Moved 8 emails to Archive

→ "/email:inbox" to check remaining emails
→ "Undo" to move these back to INBOX
```

**Tip:** Combine with search for powerful workflows:

```
You: "Find all emails from newsletter@dev.to and archive them"
```

## 19. Inbox Statistics and Trends

Use `/email:stats` for a quick overview of your inbox health.

**Natural language:** "How many unread emails do I have?"

**What happens:**

1. `/email:stats` calls `list_emails` and `search_emails` to gather data
2. Computes unread count, today's volume, top senders, oldest unread
3. Displays formatted statistics
4. Optional `--weekly` for trend comparison

**Example interaction:**

```
You: "/email:stats"

Claude:
Inbox Stats

Unread: 47 (12 today, 8 yesterday)
Total recent: 156 emails (last 7 days)

Top senders:
  1. boss@company.com -- 6 emails
  2. team@company.com -- 4 emails
  3. newsletter@dev.to -- 3 emails

Oldest unread: 12 days ago
  From: hr@company.com
  Subject: Benefits enrollment deadline

→ "Read oldest unread" to view it
→ "/email:triage" to classify unread
```

**Weekly comparison:**

```
You: "/email:stats --weekly"

Claude:
Weekly Comparison

           This week    Last week    Change
Received:  47           52           down 10%
Unread:    12           8            up 50%
Sent:      23           19           up 21%

→ Unread trending up -- consider /email:triage
```

**Tip:** Great for Monday morning email planning -- check stats before diving in.
