# himalaya-mcp v1.2.0 Features — Brainstorm

**Generated:** 2026-02-15
**Mode:** max + feature + save
**Duration:** ~8 min (8 expert questions + 2 agents)

## Overview

Four new feature areas for himalaya-mcp v1.2.0, expanding from 11 to 19 MCP tools.

## Features

### 1. Attachment Support (2 tools)

- `list_attachments(id)` — Standalone tool returning `[{filename, mime, size}]`
- `download_attachment(id, filename)` — Save to temp dir, return file path

**CLI basis:** `himalaya attachment list <id>`, `himalaya attachment download <id> <filename>`
**Design:** Standalone (not embedded in read_email) to keep responses clean.

### 2. Email Compose (1 tool)

- `compose_email(to, subject, body, cc?, bcc?)` — New message composition

**CLI basis:** `himalaya template write -H "To:..." -H "Subject:..." "body"` → `himalaya template send`
**Safety:** Same two-phase gate as send_email (preview → confirm=true to send).

### 3. Folder Management (3 tools)

- `create_folder(name)` — Create IMAP folder/label
- `delete_folder(name, confirm)` — Delete with safety confirmation
- `list_folders()` — Upgrade existing `email://folders` resource to tool

**CLI basis:** `himalaya folder create/delete/list`
**Note:** himalaya doesn't support rename — not included.

### 4. Calendar Integration (2 tools)

- `extract_calendar_event(id)` — Parse ICS from email attachments, return structured event data
- `create_calendar_event(event, confirm)` — Create event in Apple Calendar via AppleScript

**CLI basis:** No native calendar command. Uses attachment download to get .ics, then custom parser.
**Safety:** Two-phase confirm (preview event → confirm=true to create).
**Platform:** macOS only (AppleScript). Mock in tests, skip on CI.

## Quick Wins

1. `list_folders` tool — Already have the resource, just register as tool too
2. `compose_email` — Mirrors existing draft_reply pattern closely
3. `create_folder` / `delete_folder` — Simple client wrapper methods

## Medium Effort

4. `list_attachments` + `download_attachment` — New client methods + temp file management
5. `/email:compose` and `/email:attachments` skills

## Longer Term

6. `extract_calendar_event` — ICS parsing library or manual parsing
7. `create_calendar_event` — AppleScript integration, macOS-only testing

## Architecture

### Build Order

```
Phase 6a: Folders (independent, simplest)
Phase 6b: Compose (independent, mirrors existing pattern)
Phase 6c: Attachments (independent, but Calendar depends on it)
Phase 6d: Calendar (depends on Attachments for ICS download)
```

### Tool Count Progression

- v1.0.0: 11 tools, 4 prompts, 3 resources
- v1.2.0: 19 tools, 4 prompts, 3 resources (+8 tools)

### New Files

| File | Purpose |
|------|---------|
| `src/tools/attachments.ts` | list_attachments, download_attachment |
| `src/tools/compose-new.ts` | compose_email |
| `src/tools/folders.ts` | create_folder, delete_folder, list_folders |
| `src/adapters/calendar.ts` | ICS parser + AppleScript |
| `tests/attachments.test.ts` | ~10 tests |
| `tests/compose-new.test.ts` | ~8 tests |
| `tests/folders.test.ts` | ~8 tests |
| `tests/calendar.test.ts` | ~10 tests |
| `plugin/skills/compose.md` | /email:compose skill |
| `plugin/skills/attachments.md` | /email:attachments skill |

### Existing File Changes

| File | Change |
|------|--------|
| `src/himalaya/client.ts` | +7 methods |
| `src/himalaya/types.ts` | +3 types (Attachment, Folder, CalendarEvent) |
| `src/index.ts` | Register 8 new tools |
| `plugin/agents/email-assistant.md` | New tool awareness |
| `.claude-plugin/plugin.json` | v1.2.0, new skills |

## User Decisions (from Expert Questions)

1. Attachments: Temp dir + return path
2. Compose: Same two-phase safety gate as send_email
3. Folders: create + delete + list (no purge)
4. Calendar: Extract ICS + Apple Calendar via AppleScript
5. Attach API: Standalone tool (not embedded in read_email)
6. Calendar UX: Two-phase like send_email
7. Release: Single v1.2.0 release
8. Testing: Mock AppleScript + skip on CI

## Recommended Path

→ Ship as v1.2.0 with all 4 features
→ Build in order: Folders → Compose → Attachments → Calendar
→ Each feature is a separate worktree/branch, merged to dev sequentially
→ Estimated: ~36 new tests, bringing total from 181 to ~217
