---
name: inbox
description: This skill should be used when the user asks to "check email", "inbox", "read email", "my emails", "any new messages", "what's in my email", "show me my mail", "unread emails", "check messages", "what emails do I have", "show my inbox", or wants to see what's new in their inbox. Lists envelopes from the default inbox via himalaya CLI.
triggers:
  - check email
  - inbox
  - read email
  - my emails
  - any new messages
  - what's in my email
  - show me my mail
  - unread emails
  - check messages
---

# /himalaya:inbox - Check Email Inbox

List recent emails from your inbox via the himalaya MCP server.

## Usage

```
/himalaya:inbox              # Last 10 emails
/himalaya:inbox 20           # Last 20 emails
/himalaya:inbox "subject"    # Search by subject
```

## When Invoked

1. Call `list_emails` MCP tool (default: last 10 envelopes)
2. Display summary table: sender, subject, date, flags
3. Offer to:
   - Read any specific email (`read_email`)
   - Triage inbox (`/himalaya:triage`)
   - Reply to an email (`/himalaya:reply`)
   - Copy email to clipboard (`copy_to_clipboard`)
   - Extract action items (`create_action_item`)

## Output Format

```
📬 Inbox (10 most recent)

| # | From | Subject | Date | Flags |
|---|------|---------|------|-------|
| 1 | alice@... | Meeting tomorrow | 2h ago | ⭐ |
| 2 | bob@... | PR review needed | 4h ago | |
...

→ "Read #1" to view full email
→ "/himalaya:triage" to classify all
```
