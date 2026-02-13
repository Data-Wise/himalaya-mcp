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
