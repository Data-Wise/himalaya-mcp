# Reply to an Email

**Level 2** | **Time:** 5 minutes | **Builds on:** [Triage Your Inbox](triage-inbox.md)

---

## Step 1: Pick an email to reply to

From your triage results or inbox listing:

```
You: "Reply to email 249088"
```

## Step 2: Review the draft

Claude reads the original email, then generates a reply:

```
Draft reply to Alice (Q1 Budget Review):

---
Hi Alice,

Thanks for sharing the Q1 budget review. I've reviewed the
numbers and everything looks aligned with our targets.

Two quick questions:
1. The marketing spend seems higher than projected -- is this
   the new campaign?
2. Can we schedule time to discuss the engineering allocation?

Best,
[Your name]
---

Send this, edit it, or cancel?
```

## Step 3: Refine the draft

You can ask for changes:

```
You: "Make it shorter and more casual"
```

Claude revises:

```
Hey Alice,

Looks good overall. Quick q -- is the marketing bump from the
new campaign? And can we chat about the eng budget this week?

Cheers
---
```

## Step 4: Send (or don't)

When you're happy:

```
You: "Send it"
```

Claude calls `send_email(template, confirm: true)` and the email is sent.

!!! warning "Safety gate"
    Claude will **never** send without your explicit approval. Even if you say "reply to all my emails," each draft is shown individually for review.

## What you learned

- Replies always show a draft first
- You can refine the draft with natural language
- Sending requires explicit confirmation
- You control the tone and content

---

**Next:** [Export and Save Emails](export-save.md) | **Back to:** [Tutorials](index.md)
