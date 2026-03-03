# ORCHESTRATE: Fix Skill Loading (0 Skills Loaded)

## Problem

Claude Code loads **0 skills** from the himalaya-mcp plugin. Debug log proof:

```
Attempting to load skills from plugin email default skillsPath: .../skills
Loaded 0 skills from plugin email default directory
```

## Root Cause Analysis

### Primary: Wrong directory structure

Claude Code requires skills in **subdirectory + `SKILL.md`** format, not flat `.md` files.

Evidence from working vs broken plugins:

| Plugin | Structure | Skills Loaded |
|--------|-----------|---------------|
| plugin-dev | `skills/command-development/SKILL.md` | 7 |
| craft | `skills/guard-audit/SKILL.md` | 3 (only SKILL.md ones) |
| craft | `skills/code/sync-features.md` (flat) | 0 (ignored) |
| workflow | `skills/design/frontend-designer.md` (flat) | 0 |
| **himalaya-mcp** | `skills/inbox.md` (flat) | **0** |

Craft has 20 flat `.md` skill files but only 3 `SKILL.md` skills — and only those 3 load.

### Secondary: Colon in `name` field

`name: email:inbox` — colons likely violate the `[a-z0-9-]` naming constraint. The plugin name `email` is auto-prefixed by Claude Code, so the skill name should be bare (e.g., `inbox`).

### Non-issue: `triggers` field

Initially suspected as broken, but the official `plugin-dev` plugin uses `triggers` successfully. Keep `triggers` — they may be used for future auto-invocation matching.

## Fix Plan

### Step 1: Convert flat files to SKILL.md subdirectories

For each of the 11 skills:

```bash
# Example for inbox
mkdir -p himalaya-mcp-plugin/skills/inbox
mv himalaya-mcp-plugin/skills/inbox.md himalaya-mcp-plugin/skills/inbox/SKILL.md
```

Full list:

| Current (flat) | New (subdirectory) |
|----------------|-------------------|
| `skills/inbox.md` | `skills/inbox/SKILL.md` |
| `skills/triage.md` | `skills/triage/SKILL.md` |
| `skills/digest.md` | `skills/digest/SKILL.md` |
| `skills/compose.md` | `skills/compose/SKILL.md` |
| `skills/reply.md` | `skills/reply/SKILL.md` |
| `skills/search.md` | `skills/search/SKILL.md` |
| `skills/manage.md` | `skills/manage/SKILL.md` |
| `skills/attachments.md` | `skills/attachments/SKILL.md` |
| `skills/stats.md` | `skills/stats/SKILL.md` |
| `skills/config.md` | `skills/config/SKILL.md` |
| `skills/help.md` | `skills/help/SKILL.md` |

### Step 2: Fix `name` field in frontmatter

Remove `email:` prefix from each SKILL.md:

```yaml
# Before
---
name: email:inbox
description: Check email inbox - list and summarize recent emails via himalaya
triggers:
  - check email
  - inbox
---

# After
---
name: inbox
description: Check email inbox - list and summarize recent emails via himalaya
triggers:
  - check email
  - inbox
---
```

Keep `triggers` intact (official plugins use it).
Keep `description` as-is (no need to merge triggers into it).

### Step 3: Test

1. `npm test` — all 335 tests should still pass (skill body content unchanged)
2. Clear plugin cache:
   ```bash
   rm -rf ~/.claude/plugins/cache/himalaya-mcp/
   rm -rf ~/.claude/plugins/cache/local-plugins/himalaya-mcp/
   ```
3. Restart Claude Code session
4. Verify `/email:inbox` appears when typing `/`
5. Check debug log for `Loaded 11 skills from plugin email`

### Step 4: Commit

```
fix: convert skills to SKILL.md subdirectory format

Claude Code requires skills in `skills/name/SKILL.md` subdirectory
structure, not flat `skills/name.md` files. Also removed `email:`
prefix from skill names since the plugin name is auto-prefixed.

Previously loaded 0 of 11 skills; now all 11 load correctly.
```

## Files to Change

### Move (11 files):

```
himalaya-mcp-plugin/skills/inbox.md       → himalaya-mcp-plugin/skills/inbox/SKILL.md
himalaya-mcp-plugin/skills/triage.md      → himalaya-mcp-plugin/skills/triage/SKILL.md
himalaya-mcp-plugin/skills/digest.md      → himalaya-mcp-plugin/skills/digest/SKILL.md
himalaya-mcp-plugin/skills/compose.md     → himalaya-mcp-plugin/skills/compose/SKILL.md
himalaya-mcp-plugin/skills/reply.md       → himalaya-mcp-plugin/skills/reply/SKILL.md
himalaya-mcp-plugin/skills/search.md      → himalaya-mcp-plugin/skills/search/SKILL.md
himalaya-mcp-plugin/skills/manage.md      → himalaya-mcp-plugin/skills/manage/SKILL.md
himalaya-mcp-plugin/skills/attachments.md → himalaya-mcp-plugin/skills/attachments/SKILL.md
himalaya-mcp-plugin/skills/stats.md       → himalaya-mcp-plugin/skills/stats/SKILL.md
himalaya-mcp-plugin/skills/config.md      → himalaya-mcp-plugin/skills/config/SKILL.md
himalaya-mcp-plugin/skills/help.md        → himalaya-mcp-plugin/skills/help/SKILL.md
```

### Edit (11 files — frontmatter only):

Remove `email:` prefix from `name` field in each SKILL.md.

## Scope

- Directory restructure + frontmatter name fix only
- No body/instruction changes needed
- No version bump needed (bugfix for existing release)
- Homebrew formula rebuild needed after merge to distribute fix
- Clear plugin cache after install to pick up changes

## Post-Fix Verification

After restart, debug log should show:
```
Loaded 11 skills from plugin email default directory
```

And `/email:inbox`, `/email:triage`, etc. should appear in skill autocomplete.
