# Automate with the Agent

**Level 3** | **Time:** 10 minutes | **Builds on:** [All Level 2 tutorials](index.md)

The email-assistant agent combines all previous workflows into one autonomous session.

---

## Step 1: Start the agent

```
You: "Handle my email"
```

The agent scans your inbox, reads unread emails, and classifies everything.

## Step 2: Review the plan

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

## Step 3: Process actionable emails

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

## Step 4: Handle bulk actions

After replies, the agent processes FYI and low-priority:

```
Bulk actions:
- Mark 5 FYI emails as read? (y/n)
- Archive 7 low-priority emails? (y/n)
```

## Step 5: Get the report

The agent generates a final digest:

```
Session complete:
- 3 replies sent
- 5 emails marked read
- 7 emails archived
- 0 remaining unread

Time saved: ~25 minutes of manual email work
```

## What you learned

- The agent automates the full triage-read-reply cycle
- Each reply still requires your explicit approval
- Bulk actions are grouped for efficiency
- Nothing is deleted -- only flagged, moved, or replied to

---

**Back to:** [Tutorials](index.md)
