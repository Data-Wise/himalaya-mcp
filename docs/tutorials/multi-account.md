# Multi-Account Email

**Level 1** | **Time:** 3 minutes | **Builds on:** [Read Your First Email](read-first-email.md)

---

## Step 1: Check available accounts

```
You: "What email accounts do I have?"
```

Claude reads your himalaya configuration and lists accounts.

## Step 2: Read from a specific account

```
You: "Check my work inbox"
```

Claude calls `list_emails(account: "work")`.

## Step 3: Cross-account workflow

```
You: "Check both my work and personal inboxes"
```

Claude runs two separate queries and presents combined results with account labels.

## Step 4: Set a default

In your MCP server config, set `HIMALAYA_ACCOUNT`:

```json
{
  "env": {
    "HIMALAYA_ACCOUNT": "work"
  }
}
```

Now `list_emails` defaults to your work account. Override per-call with "check my personal inbox."

## What you learned

- Each himalaya account is accessible by name
- Claude can query multiple accounts in one request
- `HIMALAYA_ACCOUNT` sets the default for all tools

---

**Next:** [Triage Your Inbox](triage-inbox.md) (Level 2) | **Back to:** [Tutorials](index.md)
