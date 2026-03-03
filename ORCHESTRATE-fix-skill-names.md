# ORCHESTRATE: Fix Skill Names

## Problem

Claude Code loads **0 skills** from the himalaya-mcp plugin because:

1. **Colons in `name` field** — `name: email:inbox` violates `[a-z0-9-]` validation
2. **`triggers` field** — not a supported frontmatter field, may cause parse failure
3. Plugin name `email` is auto-prefixed by Claude Code, so `name: inbox` → `/email:inbox`

Debug log proof:
```
Loaded 0 skills from plugin email default directory
```

## Fix (All 11 skill files)

For each file in `himalaya-mcp-plugin/skills/*.md`:

### 1. Remove `email:` prefix from `name` field

| File | Before | After |
|------|--------|-------|
| inbox.md | `name: email:inbox` | `name: inbox` |
| triage.md | `name: email:triage` | `name: triage` |
| digest.md | `name: email:digest` | `name: digest` |
| compose.md | `name: email:compose` | `name: compose` |
| reply.md | `name: email:reply` | `name: reply` |
| search.md | `name: email:search` | `name: search` |
| manage.md | `name: email:manage` | `name: manage` |
| attachments.md | `name: email:attachments` | `name: attachments` |
| stats.md | `name: email:stats` | `name: stats` |
| config.md | `name: email:config` | `name: config` |
| help.md | `name: email:help` | `name: help` |

### 2. Remove `triggers` block from all skill files

The `triggers` field is not in the supported skill frontmatter spec. Remove it entirely from all 11 files.

Supported frontmatter fields: `name`, `description`, `argument-hint`, `disable-model-invocation`, `user-invocable`, `allowed-tools`, `model`, `context`, `agent`, `hooks`.

### 3. Move trigger content into `description`

The trigger keywords are still valuable — Claude uses `description` to decide when to auto-invoke skills. Merge the trigger keywords into the description so Claude can still match them.

Example:
```yaml
# Before
---
name: email:inbox
description: Check email inbox - list and summarize recent emails via himalaya
triggers:
  - check email
  - inbox
  - read email
  - my emails
---

# After
---
name: inbox
description: Check email inbox - list and summarize recent emails via himalaya. Trigger on "check email", "inbox", "read email", "my emails".
---
```

### 4. Test

- `npm test` — all 335 tests should still pass (skill content unchanged)
- Verify with `himalaya-mcp doctor` if applicable
- Restart Claude Code session and confirm `/email:inbox` appears in skill list

### 5. Commit

```
fix: remove colon from skill names and unsupported triggers field

Claude Code auto-prefixes plugin name to skill names, so `name: email:inbox`
became `email:email:inbox` causing silent load failure (0 skills loaded).
Fixed by using bare names (`name: inbox`) and removing unsupported `triggers`
frontmatter field. Trigger keywords merged into description.
```

## Files to Change

- `himalaya-mcp-plugin/skills/inbox.md`
- `himalaya-mcp-plugin/skills/triage.md`
- `himalaya-mcp-plugin/skills/digest.md`
- `himalaya-mcp-plugin/skills/compose.md`
- `himalaya-mcp-plugin/skills/reply.md`
- `himalaya-mcp-plugin/skills/search.md`
- `himalaya-mcp-plugin/skills/manage.md`
- `himalaya-mcp-plugin/skills/attachments.md`
- `himalaya-mcp-plugin/skills/stats.md`
- `himalaya-mcp-plugin/skills/config.md`
- `himalaya-mcp-plugin/skills/help.md`

## Scope

- Only frontmatter changes — no body/instruction changes needed
- No version bump needed (this is a bugfix within existing release)
- May want to clear plugin cache after install: `rm -rf ~/.claude/plugins/cache/himalaya-mcp/` and `rm -rf ~/.claude/plugins/cache/local-plugins/himalaya-mcp/`
