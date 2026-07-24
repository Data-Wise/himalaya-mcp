---
name: digest
description: This skill should be used when the user asks for "email digest", "daily digest", "email summary", "email roundup", "summarize my inbox", "what did I miss", "summary of recent emails", or wants a quick summary of recent messages. Generates a markdown digest grouped by priority. For a full morning briefing with calendar events and action items, use /himalaya:morning instead.
triggers:
  - email digest
  - daily digest
  - email summary
  - email roundup
  - summarize my inbox
  - what did I miss
---

# /himalaya:digest - Daily Email Digest

Generate a markdown summary of today's important emails.

## Usage

```
/himalaya:digest             # Today's digest
/himalaya:digest --days 3    # Last 3 days
/himalaya:digest --export    # Save to markdown file
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
