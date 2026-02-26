---
name: email:stats
description: Email inbox statistics — unread count, top senders, oldest unread, volume trends
triggers:
  - email stats
  - inbox stats
  - email analytics
  - how many unread
  - email summary
---

# /email:stats - Inbox Statistics

Get a quick overview of your inbox: unread count, volume, top senders, and oldest unread.

## Usage

```
/email:stats                # Current inbox snapshot
/email:stats --weekly       # Include week-over-week comparison
/email:stats --folder Sent  # Stats for a specific folder
```

## When Invoked

1. Call `list_emails` with `page_size: 50` to get recent emails
2. Call `search_emails` with `not flag Seen` to get unread count
3. Compute statistics from the results:
   - Total unread count
   - Today's email count
   - Yesterday's email count
   - Top senders (by frequency in recent emails)
   - Oldest unread email (date and sender)
4. If `--weekly` flag: call `list_emails` for previous week and compare
5. Display formatted statistics

## MCP Tools Used

- `list_emails` — to get recent envelopes and counts
- `search_emails` — to filter by unread status and date ranges

## Output Format

```
📊 Inbox Stats

Unread: 47 (12 today, 8 yesterday)
Total recent: 156 emails (last 7 days)

Top senders:
  1. boss@company.com — 6 emails
  2. team@company.com — 4 emails
  3. newsletter@dev.to — 3 emails
  4. github@notifications — 3 emails
  5. ci@builds.io — 2 emails

Oldest unread: 12 days ago
  From: hr@company.com
  Subject: Benefits enrollment deadline

→ "Read oldest unread" to view it
→ "/email:triage" to classify unread
→ "/email:manage archive" to bulk archive
```

## Weekly Comparison (--weekly)

```
📊 Inbox Stats (Weekly)

           This week    Last week    Change
Received:  47           52           ↓ 10%
Unread:    12           8            ↑ 50%
Sent:      23           19           ↑ 21%

Top senders this week:
  1. boss@company.com — 6 emails
  ...

→ Unread trending up — consider /email:triage
```
