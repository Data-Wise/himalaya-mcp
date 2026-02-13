---
name: email:digest
description: Generate a daily email digest - summarize today's important emails in markdown
triggers:
  - email digest
  - daily digest
  - email summary
  - morning briefing
---

# /email:digest - Daily Email Digest

Generate a markdown summary of today's important emails.

## Usage

```
/email:digest             # Today's digest
/email:digest --days 3    # Last 3 days
/email:digest --export    # Save to markdown file
```

## When Invoked

1. Call `list_emails` with date filter (today or specified range)
2. For each email, call `read_email` and `summarize_email` prompt
3. Use `daily_email_digest` MCP prompt to compile digest
4. Display digest in terminal
5. If `--export`, call `export_to_markdown` tool
6. If `--clipboard`, call `copy_to_clipboard` with the digest text

## Output Format

```
📰 Email Digest — 2026-02-13

## Actionable
- **Meeting tomorrow** (alice@...) — Needs RSVP by 5pm
- **Q1 report** (boss@...) — Due Friday, template attached

## Updates
- **PR merged** (github@...) — feature/auth → main
- **CI passed** (github@...) — All 45 tests green

## FYI
- **Newsletter** — 3 new R packages on CRAN this week

---
📊 Stats: 12 emails, 2 actionable, 4 updates, 6 skipped
```
