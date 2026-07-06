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
        <string>Run /email:triage for my work inbox and summarize</string>
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

## Step 5: End-of-day report generation

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

---

**Back to:** [Tutorials](index.md) | **Related:** [Integrations Guide](../guide/integrations.md)
