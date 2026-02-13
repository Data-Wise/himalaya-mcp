---
name: email:triage
description: AI-powered email triage - classify inbox emails as actionable, informational, or skip
triggers:
  - triage email
  - classify email
  - sort email
---

# /email:triage - AI Email Triage

Classify inbox emails using Claude's reasoning via MCP prompts.

## Usage

```
/email:triage             # Triage last 10 emails
/email:triage 20          # Triage last 20
/email:triage --folder Sent  # Triage specific folder
```

## When Invoked

1. Call `list_emails` MCP tool to get recent envelopes
2. For each email, call `read_email` to get body
3. Use `triage_inbox` MCP prompt to classify:
   - **Actionable** - requires response or action
   - **Informational** - read but no action needed
   - **Skip** - spam, newsletters, can ignore
4. Display classified results
5. Offer batch actions (flag, move, archive)

## Output Format

```
📋 Triage Results (10 emails)

🔴 Actionable (3):
  1. alice@... — Meeting tomorrow (needs RSVP)
  2. boss@... — Q1 report due Friday
  3. student@... — Question about assignment

🟡 Informational (4):
  4. github@... — PR merged: feature/auth
  5. newsletter@... — Weekly digest
  ...

⚪ Skip (3):
  8. spam@... — ChatGPT for Excel
  ...

→ "Flag 8 as junk" to mark spam
→ "Read #2" for full email
```
