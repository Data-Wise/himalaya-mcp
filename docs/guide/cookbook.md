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

## Recipe 9: Conference Email Cleanup

Clean up after a conference or event.

```
You: "Find all emails about the developer conference and archive them"

Step 1: "/email:search from:conf-organizer@conference.com"
  → Find all conference-related emails

Step 2: "Also search for subject:devcon"
  → Find related threads

Step 3: "/email:manage move all-results Conference-Archive"
  → Move to a dedicated folder for reference
```

**Variation:** Search by date range to catch pre/post-conference email:
`/email:search after:2026-06-01 before:2026-06-15 --unread`

---

## Recipe 10: Team Inbox Collaboration

Share inbox management across a team using a shared account.

```
You: "/email:config --add-account"
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

Step 1: "/email:search --unread"
  → See what's waiting

Step 2: "Compose a vacation auto-reply to anyone who emails me"
  → Claude drafts a polite OOO message

Step 3: Create a filter rule in your email provider,
        or forward to a colleague for coverage

Step 4: "Mark all unread as seen before I leave"
  → /email:manage flag [ids] Seen
```

**Consideration:** himalaya-mcp doesn't set server-side filters. Use your email provider's filtering for true auto-responders. Claude can help draft the response text and subject line.

---

## Recipe 12: Newsletter Triage Pipeline

Tame newsletter overload.

```
You: "/email:stats"
  → See your newsletter volume

You: "Find all newsletter senders"
  → Claude searches recurring sender patterns

You: "Show me the top 5 newsletter senders by volume"
  → Claude analyzes and presents

You: "Unsubscribe me from the low-value ones"
  → Claude drafts unsubscribe emails
  → Review and send each one

You: "Archive all existing newsletters"
  → /email:manage archive [all-newsletter-ids]
```

**Suggestion:** After cleaning up, set a weekly routine:
```
Every Friday: "/email:search from:newsletter --unread"
→ Read the 2-3 you care about
→ "/email:manage archive rest"
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
| Conference cleanup | search → manage → move | Find event → archive → organize |
| Team inbox | config → search → draft → move | Add account → triage → reply → file |
| Vacation OOO | search → read → compose → flag | Assess → draft → filter → mark read |
| Newsletter triage | stats → search → draft → archive | Analyze → choose → unsubscribe → clean |
| End of day | stats → triage → manage → stats | Assess → classify → clean → verify |
