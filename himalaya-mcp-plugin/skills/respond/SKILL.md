---
name: respond
description: This skill should be used when the user asks to "respond to all my emails", "batch reply", "draft replies for everything", "answer all emails", "mass respond", "generate draft replies", "reply to all unread", "process my inbox replies", "bulk respond", "catch up on replies", or wants to batch-generate draft replies for multiple emails at once. For single-reply use /himalaya:reply instead.
triggers:
  - respond to all
  - batch reply
  - draft replies
  - answer all emails
  - mass respond
  - generate draft replies
  - reply to all unread
  - bulk respond
  - catch up on replies
  - process inbox replies
---

# /himalaya:respond - Batch Draft Replies

Draft replies for multiple actionable emails at once with a review-and-approve workflow.

## Usage

```
/himalaya:respond                         # Draft replies for actionable emails
/himalaya:respond --review                # Review previously generated drafts
/himalaya:respond <count>                 # Process N recent emails
```

## When Invoked

1. Call `list_emails(page_size: 25)` to get recent emails
2. Call `read_email` on each email to understand content
3. Identify actionable emails (require a response)
4. For each actionable email, call `draft_reply` to generate a draft
5. Present a summary table of all drafts:

   | ID | From | Subject | Draft Summary | Status |
   |---|---|---|---|---|
   | 42 | Alice | Meeting | Confirmed attendance | Ready |
   | 43 | Bob | Budget | Needs review | Ready |

6. Let the user review, edit, or approve individual drafts
7. Send only approved drafts via `send_email` with `confirm=true`

## Safety Rules

- NEVER send without explicit user approval per-draft
- Always present the full draft before any single send
- Let the user approve drafts individually, not as a batch
- If the user says "edit", revise and re-show the draft
