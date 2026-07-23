# Advanced Automation

**Level 3** | **Time:** 10 minutes | **Builds on:** [Automate with the Agent](automate-agent.md)

---

This tutorial covers automated email workflows using the email-assistant agent, cron scheduling, and conditional filters.

## Step 1: Scheduled morning triage

```
You: "Every morning at 8am, triage my inbox and give me a summary"
```

The email-assistant agent can be configured to run scheduled tasks. On macOS, this uses `launchd`:

```bash
# ~/Library/LaunchAgents/com.himalaya-mcp.morning-triage.plist
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"\
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.himalaya-mcp.morning-triage</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/claude</string>
        <string>--execute</string>
        <string>Run /himalaya:triage for my work inbox and summarize</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>8</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
</dict>
</plist>
```

**Note:** Claude Code does not currently support headless execution. This pattern works when Claude Code is running and the agent is active.

## Step 2: Cross-account rules

```
You: "Forward all personal email receipts to my accountant on Fridays"
```

Workflow:

1. Search personal account for receipts: `search_emails(account: "personal", query: "subject:receipt OR subject:invoice")`
2. Flag each: `flag_email(id, flags: ["Flagged"], action: "add")`
3. Draft a forwarding email with the receipts as context
4. Review and approve before sending

## Step 3: Conditional auto-filtering

```
You: "Auto-archive newsletters I haven't opened in 7 days"
```

The agent will:

1. `search_emails(query: "--unread before:7-days-ago")` — find old unread
2. Identify newsletters by sender pattern
3. Present the list for your approval (safety gate)
4. `move_email(id, target_folder: "Archive")` — archive confirmed items

## Step 4: Automated meeting prep

```
You: "Before my 10am standup, gather all emails about project Alpha"
```

The agent:

1. `search_emails(query: "subject:Alpha")` — find project emails
2. `read_thread` on each thread — gather full context
3. `create_action_item` — extract todos
4. Presents a one-page briefing

## Step 5: Consolidated task extraction

```
You: "Gather all action items from this week's email into one list"
```

The agent:

1. `search_emails(query: "after:7-days-ago")` — all email from the past week
2. `create_action_item` on each — extract todos and deadlines
3. Deduplicates and groups by urgency
4. Presents a consolidated task list with email cross-references

```
Task Board — Week of 2026-03-09

## Due This Week
- [ ] Approve Q1 budget — from "Q1 Budget Review" (cfo@...)
- [ ] Submit quarterly report — from "Q4 Reporting" (pm@...)

## Due Next Week
- [ ] Review updated timeline — from "Project Alpha Update" (pm@...)
- [ ] Schedule stakeholder demo — from "Alpha Launch Plan" (dir@...)

## No Deadline
- [ ] Check benefits enrollment — from "Open Enrollment" (hr@...)
```

---

## Step 6: Notification routing

```
You: "Sort my notifications into folders — CI builds to Updates,
      GitHub to Dev, newsletters to Reading"
```

The agent iterates through recent emails, categorizes by sender/pattern, and moves:

1. `list_emails(page_size: 100)` — scan recent email
2. Identify notification patterns (GitHub, CI, newsletters, calendar)
3. For each category, `move_email` to the appropriate folder
4. Present a summary of what was filed where

```
Routed 23 emails:
  GitHub → Dev          (8 PRs, issues)
  CI/CD → Updates       (5 build notifications)
  Newsletters → Reading (6 weekly digests)
  Calendar → Updates    (4 meeting reminders)
```

**Tip:** Run this weekly to keep your inbox organized automatically.

---

## Step 7: Smart folder rules

```
You: "Auto-archive any email from noreply@ that I haven't read in 3 days"
```

Combines conditional filtering with folder rules:

1. `search_emails(query: "from:noreply --unread before:3-days-ago")` — find candidates
2. Show the count and ask for confirmation
3. `move_email(id, target_folder: "Archive")` for each

**Pattern library:**

```
"Auto-archive all LinkedIn notifications after 24 hours"
→ search_emails(query: "from:linkedin --unread before:1-days-ago")
→ move_email to Archive

"Move all PR review requests to a Dev folder"
→ search_emails(query: "subject:\"PR\" OR subject:\"pull request\"")
→ move_email to Dev

"Flag all emails from my boss as important"
→ search_emails(query: "from:boss@company.com")
→ flag_email(flags: ["Flagged"], action: "add")
```

---

## Step 8: End-of-day report generation

```
You: "Each evening, give me a summary of what I handled today"
```

The agent chains:

1. `list_emails(page_size: 100)` — today's inbox
2. `search_emails(query: "from:me")` — what you sent
3. Compares to yesterday's unread count
4. Generates a daily activity report

## What you learned

- The email-assistant agent can chain multi-step workflows
- Cross-account rules keep work and personal email organized
- Conditional auto-filtering reduces inbox noise
- Automated meeting prep saves context-gathering time
- Scheduled patterns work best with the agent active in Claude Code
- Task extraction across multiple emails creates a consolidated action board
- Notification routing keeps different email types organized automatically
- Smart folder rules can be built by combining search + conditional logic

---

**Back to:** [Tutorials](index.md) | **Related:** [Integrations Guide](../guide/integrations.md)
