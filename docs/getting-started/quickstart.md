# Quick Start

Get from zero to reading email in 2 minutes.

## 1. Install

=== "Homebrew (recommended)"

    ```bash
    brew tap data-wise/tap
    brew install himalaya-mcp
    ```

    Zero config. Installs deps, builds, symlinks, auto-enables.

=== "GitHub Marketplace"

    Requires `brew install node himalaya` separately.

    ```bash
    claude plugin marketplace add Data-Wise/himalaya-mcp
    claude plugin install email
    ```

=== "From Source"

    ```bash
    brew install himalaya
    git clone https://github.com/Data-Wise/himalaya-mcp.git
    cd himalaya-mcp && npm install && npm run build
    ln -s $(pwd) ~/.claude/plugins/himalaya-mcp
    ```

Restart Claude Code after install.

## 2. Verify

```bash
himalaya-mcp doctor    # Check all settings
```

## 3. Try It

```
You: "Check my inbox"
```

Claude calls `list_emails` and shows your recent emails:

```
Found 5 emails in INBOX:

| ID     | From              | Subject                  | Date       | Flags |
|--------|-------------------|--------------------------|------------|-------|
| 249088 | alice@work.com    | Q1 Budget Review         | 2026-02-13 | Seen  |
| 249064 | bob@team.com      | Sprint Retrospective     | 2026-02-13 |       |
| 249051 | boss@work.com     | Meeting Tomorrow         | 2026-02-12 | Seen  |
| 249030 | news@devweekly.io | This Week in TypeScript   | 2026-02-12 | Seen  |
| 249015 | hr@company.com    | Benefits Enrollment      | 2026-02-11 |       |
```

## 4. Common Commands

| What you say | What happens |
|-------------|--------------|
| "Check my inbox" | Lists recent emails |
| "Read email 249088" | Shows full email body |
| "Triage my inbox" | Classifies emails, suggests actions |
| "Reply to 249088" | Drafts reply, shows for approval |
| "Give me today's digest" | Priority-grouped summary |
| "Export 249088 as markdown" | Email with YAML frontmatter |
| "Flag 249088 as important" | Adds Flagged flag |
| "Archive email 249064" | Moves to Archive folder |

## 5. Safety

- Claude **never sends email** without your explicit "yes" / "send it"
- `send_email` shows a preview first -- you approve before it sends
- No emails are ever deleted -- only flagged or moved

## Next Steps

- [Tutorials](../tutorials/index.md) -- step-by-step from beginner to automation
- [User Guide](../guide/guide.md) -- all 19 tools, 4 prompts, 3 resources
- [Workflows](../guide/workflows.md) -- triage, reply, digest, export patterns
- [Quick Reference](../reference/refcard.md) -- one-page cheat sheet
