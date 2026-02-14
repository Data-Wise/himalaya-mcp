# Export and Save Emails

**Level 2** | **Time:** 3 minutes | **Builds on:** [Read Your First Email](read-first-email.md)

---

## Step 1: Export as markdown

```
You: "Export email 249088 as markdown"
```

Claude calls `export_to_markdown` and returns:

```yaml
---
subject: "Q1 Budget Review"
from: "Alice <alice@work.com>"
to: "You <you@work.com>"
date: "2026-02-13"
id: "249088"
flags: [Seen, Flagged]
---

# Q1 Budget Review

Hi team, please review the attached budget...
```

## Step 2: Copy to clipboard

```
You: "Copy that to my clipboard"
```

Claude calls `copy_to_clipboard` with the markdown text.

## Step 3: Extract action items

```
You: "What are the action items from that email?"
```

Claude calls `create_action_item` and returns:

```
Action items from "Q1 Budget Review":
- [ ] Review budget spreadsheet
- [ ] Submit feedback by Friday 2026-02-14
- [ ] Schedule follow-up meeting
```

## Step 4: Combine for productivity

```
You: "Export the email as markdown, extract the action items,
      and copy everything to my clipboard"
```

Claude chains the operations and copies the combined output.

## What you learned

- `export_to_markdown` creates structured markdown with YAML frontmatter
- `copy_to_clipboard` puts text on your system clipboard
- `create_action_item` extracts todos and deadlines
- You can chain multiple operations in a single request

---

**Next:** [Automate with the Agent](automate-agent.md) (Level 3) | **Back to:** [Tutorials](index.md)
