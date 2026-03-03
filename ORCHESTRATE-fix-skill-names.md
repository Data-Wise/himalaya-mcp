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

### Secondary: Colon in `name` field

`name: email:inbox` — colons likely violate the `[a-z0-9-]` naming constraint. The plugin name `email` is auto-prefixed by Claude Code, so the skill name should be bare (e.g., `inbox`).

### Non-issue: `triggers` field

Official `plugin-dev` plugin uses `triggers` successfully. Keep `triggers`.

---

## Decisions (User Approved)

| Decision | Choice |
|----------|--------|
| **Scope** | Fix all three plugins (himalaya-mcp, craft, workflow) |
| **Descriptions** | Enhance to "This skill should be used when..." pattern |
| **Cache handling** | Both: document manual clear + add to `doctor --fix` |
| **Versioning** | Bump to v1.4.1 |

---

## Increment 1: Fix himalaya-mcp skills (primary)

### Step 1.1: Convert flat files to SKILL.md subdirectories

For each of the 11 skills:

```bash
mkdir -p himalaya-mcp-plugin/skills/inbox
git mv himalaya-mcp-plugin/skills/inbox.md himalaya-mcp-plugin/skills/inbox/SKILL.md
# repeat for all 11
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

### Step 1.2: Fix `name` field + enhance descriptions

Remove `email:` prefix and enhance descriptions to match the working pattern:

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
description: This skill should be used when the user asks to "check email", "inbox", "read email", "my emails", or wants to list and summarize recent emails. Lists envelopes from the default inbox via himalaya CLI.
triggers:
  - check email
  - inbox
  - read email
  - my emails
---
```

Pattern: `This skill should be used when the user asks to "[trigger1]", "[trigger2]", ... or [broader context]. [What it does in one sentence].`

Apply to all 11 skills, keeping `triggers` list intact.

### Step 1.3: Add cache clear to `doctor --fix`

In `src/cli/setup.ts`, add a new doctor check:

- **Check name**: "Plugin cache freshness"
- **Logic**: Check if `~/.claude/plugins/cache/himalaya-mcp/` or `~/.claude/plugins/cache/local-plugins/himalaya-mcp/` exists with stale version
- **Fix**: `rm -rf` the stale cache directories
- **Description**: "Clear stale plugin cache (run with --fix)"

### Step 1.4: Version bump to v1.4.1

Update all version references per the version bump checklist:

- `package.json` + `package-lock.json`
- `.claude-plugin/marketplace.json`
- `mcpb/manifest.json`
- `himalaya-mcp-plugin/.claude-plugin/plugin.json`
- `src/index.ts` — `VERSION` constant
- `tests/e2e.test.ts` — version assertion
- `CLAUDE.md`, `CHANGELOG.md`, `.STATUS`

### Step 1.5: Test

1. `npm test` — all tests pass (update test count if doctor test changes)
2. `npm run build:bundle` — bundle builds
3. Clear plugin cache manually
4. Restart Claude Code session
5. Verify `/email:inbox` appears in autocomplete
6. Check debug log: `Loaded 11 skills from plugin email`

### Step 1.6: Commits

```
fix: convert skills to SKILL.md subdirectory format

Claude Code requires skills in `skills/name/SKILL.md` subdirectory
structure, not flat `skills/name.md` files. Also removed `email:`
prefix from skill names since the plugin name is auto-prefixed.
Enhanced descriptions to "This skill should be used when..." pattern.

Previously loaded 0 of 11 skills; now all 11 load correctly.
```

```
feat: add plugin cache check to doctor --fix

Detects stale plugin cache directories and clears them automatically
when running `himalaya-mcp doctor --fix`.
```

```
chore: bump version to v1.4.1
```

---

## Increment 2: Fix craft skills (separate PR to craft repo)

**NOTE**: This is a separate repo — create a separate branch/PR there.

Convert craft's flat skill files to SKILL.md subdirectories:

| Current (flat, not loading) | New (subdirectory) |
|----------------------------|-------------------|
| `skills/architecture/system-architect.md` | `skills/architecture/SKILL.md` |
| `skills/ci/project-detector.md` | `skills/ci/SKILL.md` |
| `skills/code/sync-features.md` | `skills/code/SKILL.md` |
| `skills/design/backend-designer.md` | `skills/design/backend-designer/SKILL.md` |
| `skills/design/frontend-designer.md` | `skills/design/frontend-designer/SKILL.md` |
| `skills/design/devops-helper.md` | `skills/design/devops-helper/SKILL.md` |
| `skills/distribution/*.md` (5 files) | `skills/distribution/*/SKILL.md` |
| `skills/modes/mode-controller.md` | `skills/modes/SKILL.md` |
| `skills/orchestration/*.md` (2 files) | `skills/orchestration/*/SKILL.md` |
| `skills/planning/project-planner.md` | `skills/planning/SKILL.md` |
| `skills/testing/*.md` (2 files) | `skills/testing/*/SKILL.md` |

Enhance descriptions to "This skill should be used when..." pattern.

**Commit**: `fix: convert flat skills to SKILL.md subdirectory format`

---

## Increment 3: Fix workflow skills (separate PR to workflow repo)

**NOTE**: This is a separate repo — create a separate branch/PR there.

Convert workflow's flat skill files to SKILL.md subdirectories:

| Current (flat, not loading) | New (subdirectory) |
|----------------------------|-------------------|
| `skills/design/backend-designer.md` | `skills/design/backend-designer/SKILL.md` |
| `skills/design/frontend-designer.md` | `skills/design/frontend-designer/SKILL.md` |
| `skills/design/devops-helper.md` | `skills/design/devops-helper/SKILL.md` |

Enhance descriptions to "This skill should be used when..." pattern.

**Commit**: `fix: convert flat skills to SKILL.md subdirectory format`

---

## Post-Fix Verification

After restart, debug log should show:
```
Loaded 11 skills from plugin email default directory
```

And `/email:inbox`, `/email:triage`, etc. should appear in skill autocomplete.

## Files Changed (himalaya-mcp only — Increment 1)

### Moved (11 files):
- `himalaya-mcp-plugin/skills/*.md` → `himalaya-mcp-plugin/skills/*/SKILL.md`

### Edited (11 + doctor + version files):
- 11 SKILL.md files (frontmatter: name + description)
- `src/cli/setup.ts` (new doctor check)
- Version bump files (see checklist above)
- `CHANGELOG.md`, `.STATUS`
