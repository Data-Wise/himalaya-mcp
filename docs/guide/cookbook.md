# Email Cookbook

Practical recipes combining multiple skills and tools for common email scenarios.

---

## Recipe 1: Monday Morning Routine

Start your week with a structured email review.

```
You: "/email:stats"
→ See unread count, volume, top senders

You: "/email:triage"
→ Classify inbox: actionable / FYI / skip

You: "/email:manage archive" (for skip emails)
→ Bulk archive low-priority items

You: "/email:digest"
→ Generate priority digest for the week
```

**Why it works:** Stats gives you the big picture before you dive in. Triage classifies efficiently. Manage clears the noise. Digest gives you a reference for the day.

---

## Recipe 2: Inbox Zero Sprint

Aggressively clear your inbox to zero unread.

```
Step 1: "/email:stats"
  → Know the scope: "47 unread, oldest 12 days"

Step 2: "/email:triage 50"
  → Classify all 50 emails at once

Step 3: "Archive all skip emails"
  → /email:manage archive [skip IDs]

Step 4: "Mark all FYI as read"
  → /email:manage flag [fyi IDs] (Seen)

Step 5: "Draft replies for actionable emails"
  → /email:reply for each actionable email

Step 6: "/email:stats"
  → Verify: "0 unread"
```

**Time estimate:** ~15 minutes for 50 emails with Claude doing the heavy lifting.

---

## Recipe 3: Email Search Pipeline

Find, review, and act on specific emails.

```
You: "/email:search from:client --unread"
→ Find all unread client emails

You: "Read #1"
→ Review the most recent one

You: "Summarize #2 and #3"
→ Get quick summaries of the rest

You: "/email:manage flag 1,2,3"
→ Star them all for follow-up
```

**Variations:**

- By date: `/email:search from:boss after:2026-02-20`
- By topic: `/email:search budget --flagged`
- Unread only: `/email:search --unread`

---

## Recipe 4: New Account Setup

Set up himalaya from scratch using the config wizard.

```
You: "/email:config"

Claude walks you through:
1. Check himalaya installed
2. Choose provider (Gmail/Outlook/Fastmail/Custom)
3. Enter email address
4. Generate config.toml with provider settings
5. Store password in Keychain (Gmail: app password)
6. Test IMAP/SMTP connection
7. Run doctor check

You: "/email:inbox"
→ First email check with new account!
```

**Adding a second account:**

```
You: "/email:config --add-account"
→ Same wizard, appends to existing config

You: "/email:inbox" (uses default account)
You: "Check my work inbox" (uses account: "work")
```

---

## Recipe 5: Weekly Email Analytics

Track your email patterns over time.

```
You: "/email:stats --weekly"

Weekly Comparison
           This week    Last week    Change
Received:  47           52           down 10%
Unread:    12           8            up 50%

You: "Who's sending me the most email?"
→ Top senders breakdown

You: "/email:search from:newsletter"
→ Find all newsletters

You: "/email:manage archive" (newsletter IDs)
→ Clean up recurring noise
```

**Insight:** If unread is trending up, schedule a triage session. If a single sender dominates, consider filters.

---

## Recipe 6: Meeting Preparation

Gather all context before a meeting.

```
You: "/email:search from:alice Q1 budget"
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
You: "/email:stats"
→ See what came in today

You: "Triage today's unread"
→ Quick classification

You: "/email:manage flag" (tomorrow's priorities)
→ Star what needs attention tomorrow

You: "/email:manage archive" (handled items)
→ Clean up processed emails

You: "/email:stats"
→ Confirm inbox is under control
```

---

## Recipe 8: Delegation and Forwarding

Process emails that need someone else's attention.

```
You: "/email:triage"
→ Identify emails that need delegation

You: "Draft a forward of #42 to bob@team.com with context"
→ Claude composes a forwarding message

You: "Extract the action items from #42"
→ Create a todo list for the delegate

You: "/email:manage move 42 Delegated"
→ Move to a tracking folder
```

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
| End of day | stats → triage → manage → stats | Assess → classify → clean → verify |
