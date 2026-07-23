---
name: export
description: This skill should be used when the user asks to "export email", "save email", "export to markdown", "copy to clipboard", "save this email", "export as markdown", "save for later", "clip this email", "archive this to notes", or wants to preserve an email as structured markdown with YAML frontmatter and optionally copy to clipboard. Chains export_to_markdown and copy_to_clipboard.
triggers:
  - export email
  - save email
  - export to markdown
  - copy to clipboard
  - save this email
  - export as markdown
  - clip this email
  - save for later
---

# /himalaya:export - Export Email

Save an email as structured markdown with YAML frontmatter, with optional clipboard copy.

## Usage

```
/himalaya:export <id>                       # Export to markdown
/himalaya:export <id> --clipboard           # Export and copy to clipboard
/himalaya:export <id> --action-items        # Also extract action items
/himalaya:export <id> --clipboard --action-items  # Full pipeline
```

## When Invoked

1. Call `export_to_markdown` to generate structured markdown
2. If `--action-items`, also call `create_action_item` for todos/deadlines
3. If `--clipboard`, call `copy_to_clipboard` with the combined output
4. Present the exported content for review

## MCP Tools Used

- `export_to_markdown` — email to markdown with YAML frontmatter
- `create_action_item` — extract tasks, deadlines, commitments
- `copy_to_clipboard` — copy text to system clipboard

## Output Format

```
📄 Export: Q1 Budget Review

--- markdown exported ---
Subject: Q1 Budget Review
From: alice@example.com
Date: 2026-02-13
---
[full email body]

Action Items:
- [ ] Review budget spreadsheet
- [ ] Submit feedback by Friday

→ Copied to clipboard ✓
→ "Save to file" to save as .md
```
