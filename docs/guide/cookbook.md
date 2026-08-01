# Email Cookbook

Practical recipes combining multiple skills and tools for common email scenarios.

---

## Recipe 1: Monday Morning Routine

Start your week with a structured email review.

```
You: "/himalaya:stats"
→ See unread count, volume, top senders

You: "/himalaya:triage"
→ Classify inbox: actionable / FYI / skip

You: "/himalaya:manage archive" (for skip emails)
→ Bulk archive low-priority items

You: "/himalaya:digest"
→ Generate priority digest for the week
```

**Why it works:** Stats gives you the big picture before you dive in. Triage classifies efficiently. Manage clears the noise. Digest gives you a reference for the day.

---

## Recipe 2: Inbox Zero Sprint

Aggressively clear your inbox to zero unread.

```
Step 1: "/himalaya:stats"
  → Know the scope: "47 unread, oldest 12 days"

Step 2: "/himalaya:triage 50"
  → Classify all 50 emails at once

Step 3: "Archive all skip emails"
  → /himalaya:manage archive [skip IDs]

Step 4: "Mark all FYI as read"
  → /himalaya:manage flag [fyi IDs] (Seen)

Step 5: "Draft replies for actionable emails"
  → /himalaya:reply for each actionable email

Step 6: "/himalaya:stats"
  → Verify: "0 unread"
```

**Time estimate:** ~15 minutes for 50 emails with Claude doing the heavy lifting.

---

## Recipe 3: Email Search Pipeline

Find, review, and act on specific emails.

```
You: "/himalaya:search from:client --unread"
→ Find all unread client emails

You: "Read #1"
→ Review the most recent one

You: "Summarize #2 and #3"
→ Get quick summaries of the rest

You: "/himalaya:manage flag 1,2,3"
→ Star them all for follow-up
```

**Variations:**

- By date: `/himalaya:search from:boss after:2026-02-20`
- By topic: `/himalaya:search budget --flagged`
- Unread only: `/himalaya:search --unread`

---

## Recipe 4: New Account Setup

Set up himalaya from scratch using the config wizard.

```
You: "/himalaya:config"

Claude walks you through:
1. Check himalaya installed
2. Choose provider (Gmail/Outlook/Fastmail/Custom)
3. Enter email address
4. Generate config.toml with provider settings
5. Store password in Keychain (Gmail: app password)
6. Test IMAP/SMTP connection
7. Run doctor check

You: "/himalaya:inbox"
→ First email check with new account!
```

**Adding a second account:**

```
You: "/himalaya:config --add-account"
→ Same wizard, appends to existing config

You: "/himalaya:inbox" (uses default account)
You: "Check my work inbox" (uses account: "work")
```

---

## Recipe 5: Weekly Email Analytics

Track your email patterns over time.

```
You: "/himalaya:stats --weekly"

Weekly Comparison
           This week    Last week    Change
Received:  47           52           down 10%
Unread:    12           8            up 50%

You: "Who's sending me the most email?"
→ Top senders breakdown

You: "/himalaya:search from:newsletter"
→ Find all newsletters

You: "/himalaya:manage archive" (newsletter IDs)
→ Clean up recurring noise
```

**Insight:** If unread is trending up, schedule a triage session. If a single sender dominates, consider filters.

---

## Recipe 6: Meeting Preparation

Gather all context before a meeting.

```
You: "/himalaya:search from:alice Q1 budget"
→ Find all relevant threads

You: "Summarize each of these"
→ One-line summary per email

You: "Extract action items from #1 and #3"
→ Pull todos and deadlines

You: "Export all as markdown and copy to clipboard"
→ Ready to paste into meeting notes
```

---

## Recipe 7: End-of-Day Sweep + Stats

Quick cleanup before signing off.

```
You: "/himalaya:stats"
→ See what came in today

You: "Triage today's unread"
→ Quick classification

You: "/himalaya:manage flag" (tomorrow's priorities)
→ Star what needs attention tomorrow

You: "/himalaya:manage archive" (handled items)
→ Clean up processed emails

You: "/himalaya:stats"
→ Confirm inbox is under control
```

---

## Recipe 8: Delegation and Forwarding

Process emails that need someone else's attention.

```
You: "/himalaya:triage"
→ Identify emails that need delegation

You: "Draft a forward of #42 to bob@team.com with context"
→ Claude composes a forwarding message

You: "Extract the action items from #42"
→ Create a todo list for the delegate

You: "/himalaya:manage move 42 Delegated"
→ Move to a tracking folder
```

---

## Recipe 9: Conference Email Cleanup

Clean up after a conference or event.

```
You: "Find all emails about the developer conference and archive them"

Step 1: "/himalaya:search from:conf-organizer@conference.com"
  → Find all conference-related emails

Step 2: "Also search for subject:devcon"
  → Find related threads

Step 3: "/himalaya:manage move all-results Conference-Archive"
  → Move to a dedicated folder for reference
```

**Variation:** Search by date range to catch pre/post-conference email:
`/himalaya:search after:2026-06-01 before:2026-06-15 --unread`

---

## Recipe 10: Team Inbox Collaboration

Share inbox management across a team using a shared account.

```
You: "/himalaya:config --add-account"
  → Add the shared team account

You: "Check the support@ inbox"
  → list_emails(account: "support")

You: "Flag anything from urgent@clients.com"
  → search_emails + flag_email

You: "Draft a reply to the most urgent one"
  → draft_reply → review → send_email(confirm: true)

You: "Move handled emails to Processed folder"
  → move_email for each resolved item
```

**Tip:** Use the `account` parameter to tag each operation — the team always knows which inbox is being handled.

---

## Recipe 11: Vacation Auto-Reply Setup

Set up an out-of-office sequence using the compose tool.

```
You: "I'm on vacation next week. Set up an auto-reply."

Step 1: "/himalaya:search --unread"
  → See what's waiting

Step 2: "Compose a vacation auto-reply to anyone who emails me"
  → Claude drafts a polite OOO message

Step 3: Create a filter rule in your email provider,
        or forward to a colleague for coverage

Step 4: "Mark all unread as seen before I leave"
  → /himalaya:manage flag [ids] Seen
```

**Consideration:** himalaya-mcp doesn't set server-side filters. Use your email provider's filtering for true auto-responders. Claude can help draft the response text and subject line.

---

## Recipe 12: Newsletter Triage Pipeline

Tame newsletter overload.

```
You: "/himalaya:stats"
  → See your newsletter volume

You: "Find all newsletter senders"
  → Claude searches recurring sender patterns

You: "Show me the top 5 newsletter senders by volume"
  → Claude analyzes and presents

You: "Unsubscribe me from the low-value ones"
  → Claude drafts unsubscribe emails
  → Review and send each one

You: "Archive all existing newsletters"
  → /himalaya:manage archive [all-newsletter-ids]
```

**Suggestion:** After cleaning up, set a weekly routine:
```
Every Friday: "/himalaya:search from:newsletter --unread"
→ Read the 2-3 you care about
→ "/himalaya:manage archive rest"
```

---

## Recipe 13: Thread Conversation

Read a full email thread chronologically, identify participants, extract action items, and offer to reply.

```
You: "Show me the whole budget review conversation and what still needs doing"

Step 1: "/himalaya:search subject:budget"
  → Find all budget-related emails

Step 2: "Read the thread 'Q1 Budget Review'"
  → read_thread(thread_id: "Q1 Budget Review")
  → See all messages chronologically

Step 3: "What are the action items from this thread?"
  → create_action_item on each message in the thread
  → Deduplicate and consolidate

Step 4: "Draft a reply summarizing the status"
  → Draft a reply to the thread with context from all messages
  → Review and send
```

**Why threads matter:** A single email only shows one side of the conversation. Threads give you the full story — who said what, when, and what decisions were made.

---

## Recipe 14: Triage with Auto-Flag

A lighter triage variant that only flags — no moves, no archives, no deletions.

```
You: "Read my last 20 emails, flag what needs attention, and leave everything else alone"

Step 1: "/himalaya:inbox 20"
  → See what's waiting

Step 2: "Read #1, #4, #7 — they look important"
  → read_email for each

Step 3: "Star the ones I need to act on"
  → flag_email(id, flags: ["Flagged"], action: "add") for actionable items

Step 4: "Mark the ones I've read as seen"
  → flag_email(id, flags: ["Seen"], action: "add") for FYI items

Result: Important emails are starred, FYIs are marked read, newsletters are untouched.
```

**When to use this:** You're too busy for full triage but don't want to lose track of important emails. Just star them and come back later.

---

## Search Syntax Reference

himaya filter syntax for the `search_emails` tool and `/himalaya:search` skill.

### Basic filters

| Example | What it finds |
|---------|---------------|
| `subject:budget` | Subject contains "budget" |
| `from:alice` | Sender contains "alice" |
| `to:team` | Recipient contains "team" |
| `body:deadline` | Body contains "deadline" |
| `date:2026-02-13` | Sent on that date |
| `after:2026-02-01` | Sent after date |
| `before:2026-03-01` | Sent before date |
| `flag:Flagged` | Has specific flag |

### Flag predicates (shortcuts)

| Shorthand | Expands to |
|-----------|------------|
| `--unread` | `not flag Seen` |
| `--flagged` | `flag Flagged` |
| `--answered` | `flag Answered` |

### Combining filters

| Operator | Example |
|----------|---------|
| `and` | `from:alice and subject:budget` |
| `or` | `subject:invoice or subject:receipt` |
| `not` | `not flag Seen` |
| Grouping | `from:alice and (subject:meeting or subject:budget)` |

### Date math

| Pattern | Meaning |
|---------|---------|
| `after:2026-01-15` | After January 15, 2026 |
| `before:2026-02-01` | Before February 1, 2026 |
| `date:2026-01-20` | On January 20, 2026 |

Himalaya does not support relative date expressions (like `3-days-ago`). Claude translates natural language date references into absolute dates before calling `search_emails`.

### Common search patterns

```
"Find unread emails from Alice about the budget"
→ search_emails(query: "from:alice and subject:budget and not flag Seen")

"Emails from last week about invoices"
→ search_emails(query: "subject:invoice and after:2026-02-03 and before:2026-02-10")

"Flagged emails from my boss"
→ search_emails(query: "from:boss and flag:Flagged")

"All newsletters from the past month"
→ search_emails(query: "from:newsletter and after:2026-01-13")
```

---

## Recipe 15: Integration Recipes

Combine himalaya-mcp with external tools and services.

### Save to Obsidian

```
You: "Export email 42 and save it to my Obsidian vault"

Claude:
1. export_to_markdown(id: "42") → generates markdown
2. copy_to_clipboard(text) → copies to clipboard
You: paste into Obsidian
```

For automation, use the `compose_email` tool from a script:

```bash
# Save directly to vault
himalaya envelope get 42 --output json | \
  node -e "process.stdin.on('data', d => {
    const e = JSON.parse(d);
    console.log('# ' + e.subject + '\n\n**From:** ' + e.from + '\n**Date:** ' + e.date);
  })" > ~/vault/email-42.md
```

### Create Apple Reminder from action item

```
You: "Create a reminder from the action item in email 42"

Claude:
1. create_action_item(id: "42") → extract todos
2. create_reminder(title: "Review budget spreadsheet", notes: "From email 42 - Q1 Budget Review", due_date: "2026-02-14")
3. Reminder created in Apple Reminders
```

**Works with Snooze too:** Snooze an email and create a reminder to follow up:

```
You: "Remind me about email 42 next Tuesday"

Claude:
1. snooze_email(id: "42", snooze_until: "2026-03-03T09:00:00") → snoozes the email
2. create_reminder(title: "Follow up on email from Alice", due_date: "2026-03-03")
3. Both operations complete: email hidden until Tuesday, reminder set
```

### Pipe export to a script

```
You: "Export email 42 and send it to my notes API"

Claude calls export_to_markdown(id: "42")
and copy_to_clipboard(text)
→ You can then pipe it: pbpaste | curl -X POST -d @- https://notes.example.com/import
```

### Forward to SMS/email gateway

```
You: "Forward that urgent email to my phone"

1. /himalaya:forward 42 "5551234567@vtext.com"  # VZW SMS gateway
2. Review and send
```

**Tip:** Most carriers provide an email-to-SMS gateway (e.g., `number@vtext.com` for Verizon, `number@tmomail.net` for T-Mobile). Check your carrier's gateway address.

---

## Skill Combination Cheat Sheet

| Goal | Skills/Tools | Flow |
|------|-------------|------|
| Morning review | stats → triage → manage → digest | Big picture → classify → clean → reference |
| Inbox zero | stats → triage → manage → reply → stats | Scope → classify → archive → reply → verify |
| Find + act | search → read → reply/manage | Filter → review → respond |
| New setup | config → inbox → stats | Configure → test → baseline |
| Weekly review | stats --weekly → search → manage | Trends → find noise → clean up |
| Meeting prep | search → summarize → action items → export | Find → understand → extract → notes |
| Conference cleanup | search → manage → move | Find event → archive → organize |
| Team inbox | config → search → draft → move | Add account → triage → reply → file |
| Vacation OOO | search → read → compose → flag | Assess → draft → filter → mark read |
| Newsletter triage | stats → search → draft → archive | Analyze → choose → unsubscribe → clean |
| Thread review | search → threads → action items → reply | Find thread → read → extract → respond |
| Flag-only triage | inbox → read → flag | Scan → classify → star — no moves |
| Forward | forward → compose | Read original → draft → approve send |
| Undo | search → flag/move | Find mistake → reverse action |
| Integration | export → clipboard → script/app | Export → copy → pipe to tool |
| Error recovery | doctor → re-run | Diagnose → fix → retry |
| End of day | stats → triage → manage → stats | Assess → classify → clean → verify |
