# Search and Manage Emails

**Level 2** | **Time:** 5 minutes | **Builds on:** [Read Your First Email](read-first-email.md)

---

## Step 1: Search by sender

```
You: "Find emails from Alice this week"
```

Claude calls `search_emails` and returns a table:

```
| # | From              | Subject              | Date       | Flags |
|---|-------------------|----------------------|------------|-------|
| 1 | alice@work.com    | Q2 Planning          | Feb 25     |       |
| 2 | alice@work.com    | Budget Revision      | Feb 24     |       |
| 3 | alice@work.com    | Meeting Notes        | Feb 23     |       |
```

## Step 2: Search with filters

```
You: "Find unread emails about budget from last month"
```

Search supports combined filters:

| Filter | Example |
|--------|---------|
| By sender | `from:alice` |
| By subject | `subject:budget` |
| By date | `after:2026-02-01 before:2026-03-01` |
| By flag | `--unread` or `--flagged` |
| Full body | `body:meeting` (any keyword) |

## Step 3: Bulk manage results

```
You: "/himalaya:manage flag 1,3"
```

Flags emails 1 and 3 for follow-up.

```
You: "/himalaya:manage archive 2"
```

Archives the newsletter result.

## Step 4: Search then bulk act

```
You: "Find all emails from newsletter@dev.to and archive them"
```

Claude chains search into bulk management:

1. `search_emails(query: "from:newsletter@dev.to")` -- finds matches
2. Asks for confirmation (bulk safety gate)
3. `move_email(id, target_folder: "Archive")` for each result

## What you learned

- `search_emails` uses himalaya filter syntax (`from:`, `subject:`, `after:`, etc.)
- `/himalaya:manage` handles batch flag, move, and archive operations
- Search + manage chaining is the most powerful email workflow
- Bulk operations on 5+ emails trigger a confirmation gate

---

**Next:** [Export and Save Emails](export-save.md) | **Back to:** [Tutorials](index.md)
