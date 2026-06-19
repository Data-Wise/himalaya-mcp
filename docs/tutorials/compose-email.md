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

## Step 4: Send with an attachment

You can include local files in the same natural-language request:

```
You: "Email alice@example.com the Q1 report — attach /Users/me/Downloads/q1-report.pdf"
```

Claude calls `compose_email` with `attachments: ["/Users/me/Downloads/q1-report.pdf"]` and shows a preview:

```
--- EMAIL PREVIEW (not sent) ---

To: alice@example.com
Subject: Q1 Report

Hi Alice,

Please find the Q1 report attached.

Best regards

Attachments: q1-report.pdf

--- END PREVIEW ---

Send this, edit it, or cancel?
```

When you confirm, the file is validated (missing paths are caught before send) and attached using himalaya's MML format piped via stdin.

!!! tip "Multiple files"
    Pass a list: "attach the PDF and the spreadsheet" → Claude resolves paths and includes both in the preview.

## What you learned

- `compose_email` creates new emails (not replies)
- The same two-phase safety gate applies: preview first, then confirm
- You can add CC/BCC recipients
- Natural language editing works before sending
- `attachments` accepts an array of local file paths; missing files are caught before send

---

**Next:** [Attachments and Calendar](attachments-calendar.md) | **Back to:** [Tutorials](index.md)
