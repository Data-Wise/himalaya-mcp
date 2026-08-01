---
name: morning
description: This skill should be used when the user asks for "morning briefing", "morning email", "start my day", "what happened overnight", "catch me up on email", "daily briefing", "email briefing", "morning roundup", or wants a comprehensive morning email review with urgency classification and action items.
triggers:
  - morning briefing
  - morning email
  - start my day
  - what happened overnight
  - catch me up
  - daily briefing
---

# /himalaya:morning - Morning Email Briefing

Comprehensive morning email briefing with urgency classification, calendar events, and action items.

## Usage

```
/himalaya:morning              # Full morning briefing
/himalaya:morning work         # Briefing for work account
```

## When Invoked

1. Invoke the `morning_briefing` MCP prompt (pass account if specified)
2. Follow the prompt instructions to:
   - List and classify unread emails from the last 24 hours
   - Identify calendar invites using `extract_calendar_event`
   - Extract action items from flagged emails
3. Present the structured briefing
4. Offer follow-up actions:
   - Triage remaining emails (`/himalaya:triage`)
   - Reply to urgent emails (`/himalaya:reply`)
   - Export briefing (`export_to_markdown`)
   - Quick inbox check (`/himalaya:inbox`)

## Output Format

```
Morning Briefing — 2026-03-17

## Urgent (Needs Reply Today)
- **Q1 Budget Review** from cfo@... — Needs approval by EOD
- **Client meeting reschedule** from pm@... — Proposing Thursday 2pm

## FYI
- **Sprint retrospective notes** from team@... — Action items assigned
- **PR merged** from github@... — feature/auth → main

## Calendar Events
- Team standup — 9:30am — Recurring
- Client call — 2:00pm — alice@client.com

## Action Items
- [ ] Approve Q1 budget — from CFO email
- [ ] Confirm Thursday meeting — from PM email

## Stats
- Unread: 12 | Urgent: 2 | FYI: 4 | Newsletters: 3 | Automated: 3
```
