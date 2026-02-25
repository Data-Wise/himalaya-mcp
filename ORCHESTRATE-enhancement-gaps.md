# ORCHESTRATE: himalaya-mcp Enhancement Gaps (Tier 1 + Tier 2)

**Branch:** `feature/enhancement-gaps`
**Base:** `dev`
**Spec:** `docs/specs/SPEC-enhancement-gaps-2026-02-25.md`
**Scope:** 8 items across skills, hooks, and config

## Pre-flight

```bash
# Verify worktree
git branch --show-current  # → feature/enhancement-gaps
pwd                        # → ~/.git-worktrees/himalaya-mcp/feature-enhancement-gaps

# Verify base state
ls himalaya-mcp-plugin/skills/  # 7 existing skills
ls himalaya-mcp-plugin/agents/  # 1 existing agent
```

## Increment 1: New Skills (3 files, ~1 hr)

### 1.1 Create `/email:search` skill

**File:** `himalaya-mcp-plugin/skills/search.md`

**Pattern:** Follow `inbox.md` structure (frontmatter with name, description, triggers; usage section; "When Invoked" section).

**Behavior:**
- Accept keyword, sender filter (`from:`), flag filter (`--unread`, `--flagged`)
- Call `search_emails` MCP tool
- Format results as table: date | from | subject | snippet
- Offer: read specific email, refine search, triage results
- Handle no results gracefully

**Triggers:** `search email`, `find email`, `look for email`

### 1.2 Create `/email:manage` skill

**File:** `himalaya-mcp-plugin/skills/manage.md`

**Behavior:**
- Accept action (`flag`, `unflag`, `move`, `archive`) + target list (comma-separated IDs or "all unread")
- Confirmation gate for >5 emails
- Call `flag_email` or `move_email` MCP tools in loop
- Show progress: `[3/7] Moving email #42 to Archive...`
- Summary: "Moved 7 emails to Archive"

**Triggers:** `manage email`, `bulk email`, `move emails`, `flag emails`, `archive emails`

### 1.3 Create `/email:stats` skill

**File:** `himalaya-mcp-plugin/skills/stats.md`

**Behavior:**
- Call `list_emails` with various date ranges
- Compute: unread count, today's count, top senders, oldest unread
- Optional `--weekly` flag for trend comparison
- No new MCP tools needed — all computed from existing tool output

**Output format:**
```
Inbox: 47 unread (12 today, 8 yesterday)
Top senders: boss@co (6), team@co (4), newsletter (3)
Oldest unread: 12 days ago (from: hr@company.com)
```

**Triggers:** `email stats`, `inbox stats`, `email analytics`, `how many unread`

**Commit:** `feat: add search, manage, and stats skills`

## Increment 2: `/email:config` Setup Wizard (~1.5 hr)

### 2.1 Create `/email:config` skill

**File:** `himalaya-mcp-plugin/skills/config.md`

**Behavior:**
- Check himalaya installed (`which himalaya`)
- Check config exists (`~/.config/himalaya/config.toml`)
- If no config → interactive setup:
  1. Ask provider: Gmail, Outlook, Fastmail, Custom IMAP
  2. Ask email address
  3. Generate config.toml with provider-specific IMAP/SMTP settings
  4. For Gmail: explain app password requirement, link to Google settings
  5. Test connection: `himalaya account list`
  6. Run `himalaya-mcp doctor` to verify end-to-end
- If config exists → validate and report status
- `--add-account` to add additional account
- `--check` to just validate without modifying

**Triggers:** `email config`, `email setup`, `configure email`, `himalaya setup`

**Provider templates (embed in skill):**
```toml
# Gmail
[accounts.gmail]
email = "user@gmail.com"
backend.type = "imap"
backend.host = "imap.gmail.com"
backend.port = 993
backend.encryption = "tls"
backend.auth.type = "password"
backend.auth.command = "security find-generic-password -s himalaya-gmail -w"
message.send.backend.type = "smtp"
message.send.backend.host = "smtp.gmail.com"
message.send.backend.port = 465
message.send.backend.encryption = "tls"
message.send.backend.auth.type = "password"
message.send.backend.auth.command = "security find-generic-password -s himalaya-gmail -w"
```

**Commit:** `feat: add email config setup wizard skill`

## Increment 3: Hooks (3 files, ~2 hr)

### 3.1 Create hooks directory structure

The `himalaya-mcp-plugin/hooks/` directory doesn't exist in the plugin yet. Create it.

**Note:** Claude Code plugin hooks are defined as markdown files in `hooks/` directory. Check the Claude Code plugin hook format — hooks need specific frontmatter fields (`hook_type`, `event`, etc.). Reference the craft plugin hooks for format.

### 3.2 Create post-install hook

**File:** `himalaya-mcp-plugin/hooks/post-install.md`

**Hook type:** `post_tool_use` or startup hook (check Claude Code hook API)

**Important:** Claude Code plugin hooks may not support arbitrary lifecycle events like "post-install". If the hook system only supports `PreToolUse`, `PostToolUse`, and `Notification` events, then this should be implemented differently:
- Option A: Make it a startup notification instead of a hook
- Option B: Document it as a manual step: "Run `/email:config --check` after install"
- Option C: Check if there's a `session_start` event available

**Investigate first**, then implement the best option.

### 3.3 Create session-start hook (unread notification)

**Behavior:**
- On session start, call `list_emails` with `--unread` filter
- Show one-line summary: `📧 12 unread (3 from boss@co)`
- Non-blocking, 5s timeout, skip silently on failure
- Don't run if himalaya isn't configured (check config.toml existence)

**Same investigation caveat as 3.2** — verify what hook events are available.

### 3.4 Create pre-send confirmation gate

**Behavior:**
- Intercept `send_email` and `compose_email` (when `send=true`) tool calls
- Show preview: To, Subject, first 3 lines of body
- Require explicit "send" confirmation
- Log to `~/.himalaya-mcp/sent.log` (optional)

**Hook type:** `PreToolUse` on `send_email` and `compose_email` tools.

**Commit:** `feat: add plugin hooks (post-install, session-start, pre-send)`

## Increment 4: Config and Docs (~30 min)

### 4.1 Create `.craft/homebrew.json`

**File:** `.craft/homebrew.json`

```json
{
  "formula_name": "himalaya-mcp",
  "tap": "data-wise/tap",
  "source_type": "github",
  "workflow": "homebrew-release.yml"
}
```

### 4.2 Update `/email:help` skill

**File:** `himalaya-mcp-plugin/skills/help.md`

Update to reflect new skills:
- SKILLS section: 7 → 11 (add search, manage, stats, config)
- Add hooks section to help hub
- Update skill count in header

### 4.3 Update plugin.json description

Update the skill/tool counts in `.claude-plugin/plugin.json` if they're referenced in the description.

### 4.4 Update CHANGELOG.md

Add v1.4.0 section with all changes.

**Commit:** `chore: add .craft/homebrew.json, update help skill and changelog`

## Post-Implementation

```bash
# Run tests
npm test -- --run

# Verify plugin structure
ls himalaya-mcp-plugin/skills/   # Should show 11 files
ls himalaya-mcp-plugin/hooks/    # Should show 2-3 files

# Build to verify no issues
npm run build

# Create PR
gh pr create --base dev --title "feat: enhancement gaps - skills, hooks, config"
```

## File Inventory

| File | Action | Increment |
|------|--------|-----------|
| `himalaya-mcp-plugin/skills/search.md` | Create | 1 |
| `himalaya-mcp-plugin/skills/manage.md` | Create | 1 |
| `himalaya-mcp-plugin/skills/stats.md` | Create | 1 |
| `himalaya-mcp-plugin/skills/config.md` | Create | 2 |
| `himalaya-mcp-plugin/hooks/` (directory) | Create | 3 |
| `himalaya-mcp-plugin/hooks/pre-send.md` | Create | 3 |
| `himalaya-mcp-plugin/hooks/session-start.md` | Create (if hook API supports) | 3 |
| `.craft/homebrew.json` | Create | 4 |
| `himalaya-mcp-plugin/skills/help.md` | Modify | 4 |
| `.claude-plugin/plugin.json` | Modify (counts) | 4 |
| `CHANGELOG.md` | Modify | 4 |

## Critical Notes

1. **Hook API investigation required** — Before implementing hooks in Increment 3, check what events Claude Code plugin hooks actually support. The craft plugin has hooks in `.githooks/` (git hooks), not plugin hooks. Claude Code's hook system (`.claude/hooks`) supports `PreToolUse`, `PostToolUse`, and `Notification` — these are different from plugin-level hooks. Investigate whether `himalaya-mcp-plugin/hooks/` is even the right location, or if hooks should go in the user's `.claude/hooks/` instead.

2. **Skill files are pure markdown** — No code changes for Increments 1-2. Skills are prompt templates that Claude interprets at runtime.

3. **Test after each increment** — Run `npm test -- --run` and verify `npm run build` passes.

4. **Don't modify MCP tools** — All enhancements are at the plugin layer (skills/hooks/config). The 19 MCP tools remain unchanged.
