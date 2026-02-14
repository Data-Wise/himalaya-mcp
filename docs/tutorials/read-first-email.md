# Read Your First Email

**Level 1** | **Time:** 2 minutes | **Prerequisites:** [Installation](../getting-started/installation.md) complete

---

## Step 1: List your inbox

```
You: "Check my inbox"
```

Claude calls `list_emails` and shows your recent emails in a table. Note the **ID** column -- you'll need it.

## Step 2: Read an email

Pick an ID from the list:

```
You: "Read email 249088"
```

Claude calls `read_email(id: "249088")` and shows the full plain text body.

## Step 3: Try HTML format

If the email looks poorly formatted (common with newsletters):

```
You: "Show me the HTML version"
```

Claude calls `read_email_html` for the rich text version.

## What you learned

- `list_emails` shows envelope data (sender, subject, date)
- `read_email` shows the full body
- Email IDs connect everything together

---

**Next:** [Multi-Account Email](multi-account.md) | **Back to:** [Tutorials](index.md)
