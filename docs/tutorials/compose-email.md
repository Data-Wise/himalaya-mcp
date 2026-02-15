# Compose and Send a New Email

**Level 2** | **Time:** 5 minutes | **Builds on:** [Reply to an Email](reply-email.md)

---

## Step 1: Tell Claude what to send

```
You: "Email alice@example.com about rescheduling our meeting to Thursday"
```

Claude composes the email and shows a preview:

```
--- EMAIL PREVIEW (not sent) ---

To: alice@example.com
Subject: Meeting Rescheduled to Thursday

Hi Alice,

Would it be possible to move our meeting to Thursday? I have a
conflict on the original date. Same time works for me.

Let me know if that works for you.

Best regards

--- END PREVIEW ---

Send this, edit it, or cancel?
```

## Step 2: Refine before sending

You can adjust anything:

```
You: "Add CC to bob@example.com and mention it's the Q2 planning meeting"
```

Claude revises and shows the updated preview:

```
--- EMAIL PREVIEW (not sent) ---

To: alice@example.com
Cc: bob@example.com
Subject: Reschedule Q2 Planning Meeting to Thursday

Hi Alice,

Could we move the Q2 planning meeting to Thursday? I have a
scheduling conflict on Wednesday. Happy to keep the same time.

Bob, FYI on the change.

Best regards

--- END PREVIEW ---
```

## Step 3: Send it

When you're satisfied:

```
You: "Send it"
```

Claude calls `compose_email` with `confirm=true` and the email is sent.

!!! warning "Safety gate"
    Just like replies, new emails are **never sent without your explicit approval**. Claude always shows a preview first.

## What you learned

- `compose_email` creates new emails (not replies)
- The same two-phase safety gate applies: preview first, then confirm
- You can add CC/BCC recipients
- Natural language editing works before sending

---

**Next:** [Attachments and Calendar](attachments-calendar.md) | **Back to:** [Tutorials](index.md)
