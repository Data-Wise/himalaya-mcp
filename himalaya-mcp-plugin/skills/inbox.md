---
name: email:inbox
description: Check email inbox - list and summarize recent emails via himalaya
triggers:
  - check email
  - inbox
  - read email
  - my emails
---

# /email:inbox - Check Email Inbox

List recent emails from your inbox via the himalaya MCP server.

## Usage

```
/email:inbox              # Last 10 emails
/email:inbox 20           # Last 20 emails
/email:inbox "subject"    # Search by subject
```

## When Invoked

1. Call `list_emails` MCP tool (default: last 10 envelopes)
2. Display summary table: sender, subject, date, flags
3. Offer to:
   - Read any specific email (`read_email`)
   - Triage inbox (`/email:triage`)
   - Reply to an email (`/email:reply`)
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
→ "/email:triage" to classify all
```
