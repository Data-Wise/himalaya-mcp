---
name: forward
description: This skill should be used when the user asks to "forward email", "forward this", "share this email", "send this to someone else", "pass this along", "forward this to", "redirect this email", or wants to send a copy of an email to another person. Reads the original, drafts a forward with context, and sends with safety gate.
triggers:
  - forward email
  - forward this
  - share this email
  - send this to someone else
  - pass this along
  - forward this to
  - redirect this email
---

# /himalaya:forward - Forward Email

Forward an email to another person with optional context.

## Usage

```
/himalaya:forward <id>                      # Forward email by ID
/himalaya:forward <id> "bob@example.com"    # Forward to specific recipient
/himalaya:forward <id> "bob@example.com" "Please review this"   # With context
```

## When Invoked

1. Call `read_email` to get the original message content
2. Ask for recipient and optional context (if not provided)
3. Call `compose_email` to generate the forward preview
4. Show the full preview to the user for review
5. Only call `compose_email` with `confirm=true` after explicit approval

## Safety Rules

- NEVER send without explicit user approval
- Always show the complete preview before sending
- Default to preview mode (confirm=false) on first pass
- Include attribution (original sender, date, subject) in the forwarded body

## Output Format

```
📨 Forward Preview
To: bob@example.com
Subject: Fwd: Q1 Budget Review

---
Hi Bob,

Forwarding this from Alice for your review.

---------- Forwarded message ----------
From: alice@example.com
Date: 2026-02-13
Subject: Q1 Budget Review

Hi team, please review the attached budget...

---
> "Send" to forward this email
> "Add more context" to edit
> "Cancel" to discard
```
