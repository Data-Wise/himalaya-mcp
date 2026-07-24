# SPEC — Rename Plugin `email` → `himalaya` (Issue #67)

**Date:** 2026-07-21
**Branch:** `feature/rename-plugin-email` (worktree)
**Closes:** [Data-Wise/himalaya-mcp#67](https://github.com/Data-Wise/himalaya-mcp/issues/67)
**Version:** 2.0.0 (major — breaking change: plugin name, command prefix, install command)

## Why

Issue #67 flagged that the plugin's declared name (`email`) diverges from the repo name
(`himalaya-mcp`), which silently broke aggregator resolution once (worked around in
`claude-plugins#9`). This spec renames the plugin to `himalaya` — matching the CLI binary
name, short enough for clean tool names, and close enough to the repo identity.

**Note on name divergence:** The plugin name (`himalaya`) does not exactly match the repo name
(`himalaya-mcp`). This is intentional — the `-mcp` suffix is a packaging descriptor (MCP
server), not part of the user-facing identity. Users know the tool as "himalaya", not
"himalaya-mcp". Issue #67 is closed by this change because the meaningful divergence
(generic `email` vs. identifiable `himalaya`) is eliminated. A future repo rename to
`himalaya` would fully resolve the cosmetic mismatch but is out of scope here.

## Scope

Rename plugin identifier from `email` to `himalaya` across all surfaces:
- Plugin JSON configs (name field)
- Hook matcher (PreToolUse regex)
- Test assertions (dogfood.test.ts)
- MCP server name: `himalaya` → `email` (in .mcp.json — refers to the function, not the CLI)
- 16 skill command prefixes (`/email:*` → `/himalaya:*`)
- 9+ doc files (install commands, examples)
- CHANGELOG + version bump

**Resulting tool names:** `mcp__plugin_himalaya_email__*`

## Phase 0 — Spike: verify short plugin name (MANDATORY)

**Goal:** Confirm that a plugin named `himalaya` with server named `email` works end-to-end
(the exact target pattern) before committing to the full rename.

**Tasks:**
1. Create a minimal test plugin at `/tmp/test-plugin/` with:
   - `.claude-plugin/plugin.json`: `{"name": "himalaya", "version": "0.0.1", "description": "Spike test", "hooks": {"PreToolUse": [{"matcher": "mcp__plugin_himalaya_email", "hooks": [{"type": "command", "command": "exit 0"}]}]}}`
   - One dummy MCP tool (echo back input)
   - `.mcp.json` with server name `email`
2. Install into an ISOLATED test profile: `claude plugin install --profile test-spike /tmp/test-plugin`
3. Verify:
   - [ ] Plugin loads without error (`/plugin` list shows `himalaya`)
   - [ ] Command prefix works: `/himalaya:*` registers
   - [ ] Matcher fires: tool name `mcp__plugin_himalaya_email__*` matches a `PreToolUse` matcher of `mcp__plugin_himalaya_email`
   - [ ] No collision with existing `email` MCP server (if any)
   - [ ] Uninstall: `claude plugin uninstall --profile test-spike himalaya`
4. **If ANY check fails:** abort rename, fall back to Option 4 (keep `email` + structural fix). Update SPEC accordingly.

**Duration:** ~10 minutes. Blocks all subsequent phases.

## Phase 1 — JSON configs + hook matcher + MCP server name

**Files:**
- `himalaya-mcp-plugin/.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`
- `.mcp.json`
- `himalaya-mcp-plugin/.claude-plugin/hooks/pre-send.sh`

**Pre-check (B1):** Run `claude mcp list` (or check `.mcp.json` + global config) to verify no existing MCP server is named `email`. If a collision exists, document it and decide: rename the conflicting server, or suffix ours (`himalaya-email`).

**Tasks:**
1. In `plugin.json`: change `"name": "email"` → `"name": "himalaya"`
2. In `plugin.json`: change matcher `"mcp__plugin_email_himalaya"` → `"mcp__plugin_himalaya_email"`
3. In `marketplace.json`: change `plugins[0].name` from `"email"` → `"himalaya"`
4. In `.mcp.json`: change server name `"himalaya"` → `"email"` (server refers to the function, not the CLI)
5. Verify all JSON files pass `jq empty`
6. Update `pre-send.sh` comment (line 15) to reference new matcher

## Phase 2 — Test assertions

**Files:**
- `tests/dogfood.test.ts`

**Tasks:**
1. Replace all `mcp__plugin_email_himalaya` → `mcp__plugin_himalaya_email` (10 occurrences)
2. Run `npm test` — all 569 tests must pass

## Phase 3 — Skill command prefixes

**Files (16 skill SKILL.md files):**
- `himalaya-mcp-plugin/skills/{attachments,compose,config,digest,export,forward,help,inbox,manage,morning,reply,respond,search,stats,threads,triage}/SKILL.md`

**Execution:** Dispatch 16 parallel task agents, each editing one SKILL.md. After all complete, verify with `grep -r '/email:' skills/` returning zero matches.

**Tasks per agent:**
1. In the assigned SKILL.md: replace `/email:` → `/himalaya:` in command headers, usage examples, and cross-references
2. Preserve trigger phrases in `description:` frontmatter — the following strings must NOT be edited:
   - "email digest", "daily digest", "email summary", "email roundup"
   - "morning briefing", "morning email", "email briefing", "morning roundup"
   - "check email", "inbox", "read email", "my emails", "show my inbox"
   - "search email", "find email", "email from", "email about"
   - "compose email", "write email", "send email", "new email", "email someone"
   - "reply to email", "respond to email", "draft reply", "email reply"
   - "forward email", "forward this", "share this email"
   - "triage email", "classify email", "sort email", "go through my inbox"
   - "manage email", "bulk email", "move emails", "flag emails"
   - "email stats", "inbox stats", "email analytics", "how many unread"
   - "email config", "email setup", "configure email", "himalaya setup"
   - "email help", "himalaya help", "email commands", "what can you do with email"
   - "list attachments", "download attachment", "email attachment", "calendar invite"
   - "show threads", "email conversations", "conversation view", "thread view"
   - "export email", "save email", "export to markdown", "copy to clipboard"
   - "respond to all my emails", "batch reply", "draft replies for everything"
   Only change command-syntax contexts (lines containing `/email:` as a command, not as prose)
3. Verify no broken cross-references between skills
4. Run `npm test` — all 569 tests must pass (catches broken skill references)
5. Run `grep -r '/email:' himalaya-mcp-plugin/skills/` — must return zero matches

## Phase 4 — Documentation

**Total scope:** 18 unique files, ~137 line changes across `/email:` → `/himalaya:` replacements.

### Phase 4a — Large files (dedicated task agents)

These files are too large for bulk replace. Each gets a dedicated task agent with file-specific instructions.

**File 1: `docs/guide/skills.md` (764 lines, 67 `/email:` references)**
- Every skill section has a header like `## /email:inbox` and usage examples
- **Strategy:** Task agent reads the full file, replaces ONLY command-syntax contexts:
  - `## /email:inbox` → `## /himalaya:inbox`
  - `/email:inbox` in example blocks → `/himalaya:inbox`
  - `/email:triage` in cross-references → `/himalaya:triage`
  - Line 9 table: `/email:inbox` → `/himalaya:inbox`
- **Do NOT change:** trigger phrases in prose ("check email", "my emails", etc.)
- **Verification:** After edit, `grep -c '/email:' docs/guide/skills.md` must return 0

**File 2: `docs/guide/cookbook.md` (512 lines, 43 `/email:` references)**
- Every recipe uses command syntax in code blocks
- **Strategy:** Task agent reads the full file, replaces ONLY inside code blocks (lines between ``` fences):
  - `"/email:stats"` → `"/himalaya:stats"`
  - `"/email:triage"` → `"/himalaya:triage"`
  - `"/email:manage archive"` → `"/himalaya:manage archive"`
  - All 16 skill names in recipe examples
- **Do NOT change:** prose descriptions outside code blocks ("The `/email:triage` skill..." → keep "email" in prose, only change command syntax)
- **Verification:** After edit, `grep -c '/email:' docs/guide/cookbook.md` must return 0

**File 3: `docs/guide/guide.md` (404 lines, 3 `/email:` references)**
- Comparison table (line 29) and skill list (line 75)
- **Strategy:** Task agent replaces the 3 occurrences in table/list context
- **Verification:** After edit, `grep -c '/email:' docs/guide/guide.md` must return 0

### Phase 4b — Small files (batch task agent)

Dispatch one task agent to handle all remaining doc files in a single pass.

**Install-command files (10 files):**
- `README.md` — line 10: skill list
- `CLAUDE.md` — line 291: `/email:respond` in phase table
- `docs/index.md` — lines 89-104: skill table, line 123: install command, line 162: example
- `docs/getting-started/installation.md` — lines 44-59: skill list, line 86: install, lines 237/254: variants
- `docs/getting-started/quickstart.md` — line 22: install command
- `docs/guide/troubleshooting.md` — lines 208/269: install variants
- `docs/guide/packaging.md` — lines 94/175: install commands
- `docs/reference/architecture.md` — lines 43/213-228: install + skill tree
- `docs/reference/cheat-sheet.md` — lines 8/101-106/125: install + command grid
- `.STATUS` — lines 55/83: install commands

**Skill-reference files (5 files, small occurrences):**
- `docs/getting-started/desktop-extension.md` — lines 196/198/200: comparison table
- `docs/tutorials/search-manage.md` — lines 42/48/68: 3 command refs
- `docs/tutorials/advanced-automation.md` — line 30: 1 command ref
- `docs/tutorials/migrating-from-em.md` — line 140: 1 command ref
- `docs/guide/migrating-from-em.md` — lines 19/39: 2 command refs

**Batch tasks:**
1. Replace `claude plugin install email` → `claude plugin install himalaya` in all install-command files
2. Replace `email@himalaya-mcp` → `himalaya@himalaya-mcp` in install variant references
3. Replace `email@local-plugins` → `himalaya@local-plugins` in dev install references
4. Replace `/email:` → `/himalaya:` in command-syntax contexts across all 15 files
5. Update `.STATUS` install commands

### Phase 4c — Verification

1. `grep -r 'plugin install email' docs/ README.md CLAUDE.md` — must return zero
2. `grep -r '/email:' docs/ README.md CLAUDE.md` — must return zero (command refs)
3. `grep -c '/email:' docs/guide/skills.md` — must return 0
4. `grep -c '/email:' docs/guide/cookbook.md` — must return 0
5. `grep -c '/email:' docs/guide/guide.md` — must return 0
6. Verify CHANGELOG.md is NOT modified (historical entries stay as-is)
7. Spot-check 3 random doc files to confirm quality

## Phase 4d — Migration guide

**Files:**
- `docs/getting-started/migration-v2.0.md` (new file)

**Tasks:**
1. Create migration guide with:
   - Before/after comparison table (install command, command prefix, matcher)
   - Step-by-step uninstall + re-install instructions
   - Troubleshooting section (what to do if commands don't register)
   - Link to #67 for context
2. Add prominent note in CHANGELOG linking to migration guide

## Phase 5a — Rebuild .mcpb

**Files:**
- `mcpb/manifest.json` (name already correct, but bundled plugin.json must be rebuilt)

**Tasks:**
1. Run `npm run build:mcpb` (or equivalent) to rebuild the Desktop extension with the updated plugin.json
2. Verify the .mcpb bundles the new plugin name: `unzip -p dist/himalaya-mcp.mcpb plugin/.claude-plugin/plugin.json | jq .name` → `"himalaya"`

## Phase 5b — Version bump + CHANGELOG

**Files:**
- `package.json` (version field)
- `himalaya-mcp-plugin/.claude-plugin/plugin.json` (version field)
- `.claude-plugin/marketplace.json` (metadata.version, plugins[0] if versioned)
- `mcpb/manifest.json` (version field)
- `CHANGELOG.md`

**Tasks:**
1. Bump version 1.9.0 → 2.0.0 in all version files
2. Add CHANGELOG entry: "BREAKING: Plugin name renamed from `email` to `himalaya` for repo consistency. All `/email:*` commands are now `/himalaya:*`. Existing installs must re-install: `claude plugin install himalaya`."
3. Grep for any remaining `1.9.0` references in JSON and TS files (exclude CHANGELOG.md — those are historical): `grep -r '1.9.0' --include='*.json' --include='*.ts' .`

## Phase 6 — Verify + PR

**Tasks:**
1. `npm test` — all tests pass with updated assertions
2. `npm run build` — TypeScript compiles
3. `npm run build:bundle` — esbuild bundle succeeds
4. `jq empty` on all modified JSON files
5. `git diff` review — confirm no unintended changes
6. Commit with conventional commit: `feat!: rename plugin email → himalaya (closes #67)`
7. Push, open PR to `dev`

## Acceptance criteria

**Observable outcome:** After this change, a user can run `claude plugin install himalaya`,
use `/himalaya:inbox` to check email, and the pre-send safety gate fires on send/compose —
with no reference to the old `email` plugin name anywhere in the installed plugin.

*Code & config:*
- [ ] Plugin name is `himalaya` in plugin.json, marketplace.json
- [ ] MCP server name is `email` in .mcp.json
- [ ] Hook matcher is `mcp__plugin_himalaya_email` in plugin.json
- [ ] All 10 dogfood test assertions use new matcher
- [ ] All 16 skill files use `/himalaya:` command prefix
- [ ] Version is 2.0.0 across all version files
- [ ] All 569+ tests pass
- [ ] Build + bundle succeed
- [ ] Regression test in config.test.ts asserts plugin name is `himalaya`

*Documentation:*
- [ ] All 10 install-command files reference `claude plugin install himalaya`
- [ ] `docs/guide/skills.md` has zero `/email:` command references
- [ ] `docs/guide/cookbook.md` has zero `/email:` command references
- [ ] `docs/guide/guide.md` has zero `/email:` command references
- [ ] All 5 small doc files have zero `/email:` command references
- [ ] CHANGELOG.md is NOT modified (historical entries preserved)
- [ ] `docs/getting-started/migration-v2.0.md` exists with before/after table

*Process:*
- [ ] Issue #67 closed with comment linking the PR
- [ ] Post-merge: aggregator revert PR filed on Data-Wise/claude-plugins

## Regression test

Add a test in `tests/config.test.ts` that reads `himalaya-mcp-plugin/.claude-plugin/plugin.json`
and asserts `"name": "himalaya"` — prevents future drift back to a divergent name.

## Rollback plan

If the rename breaks something unexpected post-merge:
1. Revert the merge commit on `dev`
2. Re-release as 1.9.1 (patch) from the revert
3. Reopen #67

## Post-merge: aggregator revert + .STATUS follow-up

After this PR merges and v2.0.0 is released, file a PR on `Data-Wise/claude-plugins` to
revert the workaround from `claude-plugins#9` — change the aggregator entry back from
`email` to `himalaya` (now that the plugin actually declares `himalaya`). This is
a separate PR in a separate repo, not part of this SPEC's scope, but must happen before the
next aggregator sync run.

**Consequence if skipped:** The aggregator entry stays `email` while the plugin declares
`himalaya` — the same mismatch class that created #67, just reversed. The plugin will not
resolve from the aggregator catalog. Users installing via the aggregator will get a
"plugin not found" error.

**Add to .STATUS as next action with a deadline.** If the revert stalls, the aggregator still
works via the existing workaround — but the mismatch will be reversed (aggregator says `email`,
plugin declares `himalaya`).

## Explicitly out of scope

- Aggregator-sync validation in craft (tracked separately in craft#218)
- Renaming the repo (separate decision, separate PR)
- User migration automation (no script to auto-update existing installs — users re-install manually)

## Migration notes

**Existing users must re-install:**
```bash
claude plugin uninstall email
claude plugin install himalaya
```

**If you hand-edited `.mcp.json`:** change the server name from `"himalaya"` to `"email"`:
```json
{
  "mcpServers": {
    "email": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/dist/index.js"]
    }
  }
}
```

**Breaking changes:**
- Plugin name: `email` → `himalaya`
- MCP server name: `himalaya` → `email` (in .mcp.json)
- Command prefix: `/email:*` → `/himalaya:*`
- Install command: `claude plugin install email` → `claude plugin install himalaya`
- Hook matcher: `mcp__plugin_email_himalaya` → `mcp__plugin_himalaya_email`
- Full tool names: `mcp__plugin_email_himalaya__*` → `mcp__plugin_himalaya_email__*`

## Test plan

1. Run full test suite (`npm test`) — 569+ tests, all pass
2. Manual: `claude plugin install himalaya` in a clean profile
3. Manual: verify `/himalaya:inbox` triggers correctly
4. Manual: verify pre-send hook fires on `send_email`/`compose_email`
5. Manual E2E: install → compose email → see hook preview → confirm send → verify sent.log entry
6. Manual: verify aggregator resolves `himalaya` without workaround
