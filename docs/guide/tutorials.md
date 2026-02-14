# Tutorials

Step-by-step guides from simple to advanced. Each tutorial builds on the previous one.

---

## Tutorial 1: Read Your First Email

**Time:** 2 minutes | **Prerequisites:** [Installation](../getting-started/installation.md) complete

### Step 1: List your inbox

```
You: "Check my inbox"
```

Claude calls `list_emails` and shows your recent emails in a table. Note the **ID** column -- you'll need it.

### Step 2: Read an email

Pick an ID from the list:

```
You: "Read email 249088"
```

Claude calls `read_email(id: "249088")` and shows the full plain text body.

### Step 3: Try HTML format

If the email looks poorly formatted (common with newsletters):

```
You: "Show me the HTML version"
```

Claude calls `read_email_html` for the rich text version.

### What you learned

- `list_emails` shows envelope data (sender, subject, date)
- `read_email` shows the full body
- Email IDs connect everything together

**Next:** [Tutorial 2: Triage Your Inbox](#tutorial-2-triage-your-inbox)

---

## Tutorial 2: Triage Your Inbox

**Time:** 5 minutes | **Builds on:** Tutorial 1

### Step 1: Start triage

```
You: "Triage my last 10 emails"
```

Claude reads each email and classifies them into three categories:

- **Actionable** -- needs a reply or follow-up
- **Informational** -- worth knowing, no action needed
- **Skip** -- newsletters, promotions, noise

### Step 2: Review the results

Claude presents a table like:

```
| ID     | From           | Subject          | Class        | Action          |
|--------|----------------|------------------|--------------|-----------------|
| 249088 | alice@work.com | Q1 Budget Review | Actionable   | Reply by Friday |
| 249064 | newsletter@... | Weekly Digest    | Skip         | Archive         |
| 249051 | boss@work.com  | Meeting Tomorrow | Actionable   | Flag + prepare  |
```

### Step 3: Approve actions

Claude asks what to do. You can:

- **Accept all:** "Yes, do it"
- **Cherry-pick:** "Flag the two actionable ones, but keep the newsletter"
- **Skip:** "Don't make any changes"

### Step 4: Flag and organize

If you approve, Claude executes:

```
flag_email(id: "249088", flags: ["Flagged"], action: "add")
flag_email(id: "249051", flags: ["Flagged"], action: "add")
move_email(id: "249064", target_folder: "Archive")
```

### What you learned

- Triage classifies emails into actionable categories
- Claude always asks before making changes
- Flags and moves are the primary organization tools

**Next:** [Tutorial 3: Reply to an Email](#tutorial-3-reply-to-an-email)

---

## Tutorial 3: Reply to an Email

**Time:** 5 minutes | **Builds on:** Tutorial 2

### Step 1: Pick an email to reply to

From your triage results or inbox listing:

```
You: "Reply to email 249088"
```

### Step 2: Review the draft

Claude reads the original email, then generates a reply:

```
Draft reply to Alice (Q1 Budget Review):

---
Hi Alice,

Thanks for sharing the Q1 budget review. I've reviewed the
numbers and everything looks aligned with our targets.

Two quick questions:
1. The marketing spend seems higher than projected -- is this
   the new campaign?
2. Can we schedule time to discuss the engineering allocation?

Best,
[Your name]
---

Send this, edit it, or cancel?
```

### Step 3: Refine the draft

You can ask for changes:

```
You: "Make it shorter and more casual"
```

Claude revises:

```
Hey Alice,

Looks good overall. Quick q -- is the marketing bump from the
new campaign? And can we chat about the eng budget this week?

Cheers
---
```

### Step 4: Send (or don't)

When you're happy:

```
You: "Send it"
```

Claude calls `send_email(template, confirm: true)` and the email is sent.

!!! warning "Safety gate"
    Claude will **never** send without your explicit approval. Even if you say "reply to all my emails," each draft is shown individually for review.

### What you learned

- Replies always show a draft first
- You can refine the draft with natural language
- Sending requires explicit confirmation
- You control the tone and content

**Next:** [Tutorial 4: Automate with the Agent](#tutorial-4-automate-with-the-agent)

---

## Tutorial 4: Automate with the Agent

**Time:** 10 minutes | **Builds on:** Tutorials 1-3

The email-assistant agent combines all previous workflows into one autonomous session.

### Step 1: Start the agent

```
You: "Handle my email"
```

The agent scans your inbox, reads unread emails, and classifies everything.

### Step 2: Review the plan

The agent presents a summary:

```
Scanned 15 unread emails:

Actionable (3):
  - Alice: Q1 Budget Review -- reply needed by Friday
  - Boss: Meeting Tomorrow -- needs preparation
  - Client: Project Update Request -- reply with status

FYI (5):
  - Bob: Sprint retro notes
  - DevOps: Server maintenance Saturday
  - HR: Benefits enrollment reminder
  - GitHub: 3 PRs merged
  - CI: Build passed

Low Priority (7):
  - 4 newsletters
  - 2 marketing emails
  - 1 social notification

Suggested plan:
1. Draft replies for 3 actionable emails
2. Mark 5 FYI emails as read
3. Archive 7 low-priority emails

Proceed?
```

### Step 3: Process actionable emails

For each actionable email, the agent:

1. Shows the email content
2. Generates a reply draft
3. Waits for your approval
4. Sends only after your "yes"

```
Email 1/3: Q1 Budget Review from Alice

Draft reply:
---
Hi Alice, reviewed the numbers -- looks aligned.
Two questions about marketing spend and eng allocation.
Can we chat this week?
---

Send? (yes / edit / skip)
```

### Step 4: Handle bulk actions

After replies, the agent processes FYI and low-priority:

```
Bulk actions:
- Mark 5 FYI emails as read? (y/n)
- Archive 7 low-priority emails? (y/n)
```

### Step 5: Get the report

The agent generates a final digest:

```
Session complete:
- 3 replies sent
- 5 emails marked read
- 7 emails archived
- 0 remaining unread

Time saved: ~25 minutes of manual email work
```

### What you learned

- The agent automates the full triage-read-reply cycle
- Each reply still requires your explicit approval
- Bulk actions are grouped for efficiency
- Nothing is deleted -- only flagged, moved, or replied to

---

## Tutorial 5: Multi-Account Email

**Time:** 3 minutes | **Builds on:** Tutorial 1

### Step 1: Check available accounts

```
You: "What email accounts do I have?"
```

Claude reads your himalaya configuration and lists accounts.

### Step 2: Read from a specific account

```
You: "Check my work inbox"
```

Claude calls `list_emails(account: "work")`.

### Step 3: Cross-account workflow

```
You: "Check both my work and personal inboxes"
```

Claude runs two separate queries and presents combined results with account labels.

### Step 4: Set a default

In your MCP server config, set `HIMALAYA_ACCOUNT`:

```json
{
  "env": {
    "HIMALAYA_ACCOUNT": "work"
  }
}
```

Now `list_emails` defaults to your work account. Override per-call with "check my personal inbox."

---

## Tutorial 6: Export and Save Emails

**Time:** 3 minutes | **Builds on:** Tutorial 1

### Step 1: Export as markdown

```
You: "Export email 249088 as markdown"
```

Claude calls `export_to_markdown` and returns:

```yaml
---
subject: "Q1 Budget Review"
from: "Alice <alice@work.com>"
to: "You <you@work.com>"
date: "2026-02-13"
id: "249088"
flags: [Seen, Flagged]
---

# Q1 Budget Review

Hi team, please review the attached budget...
```

### Step 2: Copy to clipboard

```
You: "Copy that to my clipboard"
```

Claude calls `copy_to_clipboard` with the markdown text.

### Step 3: Extract action items

```
You: "What are the action items from that email?"
```

Claude calls `create_action_item` and returns:

```
Action items from "Q1 Budget Review":
- [ ] Review budget spreadsheet
- [ ] Submit feedback by Friday 2026-02-14
- [ ] Schedule follow-up meeting
```

### Step 4: Combine for productivity

```
You: "Export the email as markdown, extract the action items,
      and copy everything to my clipboard"
```

Claude chains the operations and copies the combined output.
