# SPEC — Document Plugin Name Divergence (Issue #67)

**Date:** 2026-07-09
**Source:** [GRILL-plugin-name-issue-67-2026-07-09.md](GRILL-plugin-name-issue-67-2026-07-09.md)
**Closes:** [Data-Wise/himalaya-mcp#67](https://github.com/Data-Wise/himalaya-mcp/issues/67)
**Branch:** `dev` (direct edit, existing-file-only — no worktree; see GRILL decision 5)

## Why

Issue #67 flagged that the plugin's declared name (`email`) diverges from the repo name
(`himalaya-mcp`), which silently broke aggregator resolution once already (worked around in
`claude-plugins#9`). The GRILL session resolved: don't rename (renaming risks silently breaking
the pre-send safety-gate hook matcher, which is keyed to the `email` MCP tool-name prefix) —
document the divergence at its source instead.

## Scope

Two-file edit + a closing comment. No new files except this SPEC/GRILL pair. No code changes,
no version bump, no test changes (nothing about tool behavior changes).

## Phase 1 — Document the divergence

**Files:**
- `himalaya-mcp-plugin/.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`

**Tasks:**
1. In `plugin.json`, append to the existing `description` field: a clause stating the plugin id
   `email` is intentional (not a mismatch) and pointing to issue #67 for the rationale.
2. In `marketplace.json`, append the same clause to `plugins[0].description`.
3. Verify both files still parse as valid JSON (`jq empty`) and that the plugin still loads
   locally (`/plugin` or equivalent) after the edit.
4. Commit on `dev` (existing-file edit only — no new files created by this task, consistent with
   `dev`'s branch protection).
5. Open a PR (`gh pr create --base dev` is not applicable since this *is* dev directly — instead:
   since himalaya-mcp's model is `main ← dev ← feature/*`, this Phase-1-only edit lands as a
   normal commit on `dev`; a separate PR opens later for `dev → main` at the next release, per
   this repo's existing release cadence. No PR is opened as part of this phase.)
6. Comment on and close issue #67, quoting the exact description-field wording added and linking
   the commit.

## Acceptance criteria

- [ ] `plugin.json` description mentions the `email` naming is intentional + links issue #67
- [ ] `marketplace.json` plugin description carries the same note
- [ ] Both files pass `jq empty`
- [ ] Plugin still installs/loads with no behavior change (dogfood tests unaffected — no test
      file changes needed, since no tool names, matchers, or behavior changed)
- [ ] Issue #67 closed with a comment referencing the change

## Explicitly out of scope

- Renaming the plugin (rejected — GRILL decision 1)
- Any edit to `craft` (aggregator-sync validation, `craft#218`) — GRILL decision 4
- CLAUDE.md / CONTRIBUTING additions — GRILL decision 2
- Version bump / CHANGELOG entry (no functional change to ship)

## Test plan

N/A — prose/frontmatter-only change (description-field text), no parser/script/behavior touched.
Existing 569-test suite is the regression backstop; no new tests required per the tier-inference
rule (flag/frontmatter/prose-only → e2e + dogfood, and neither applies here since no *behavior*
changed — this is pure metadata).

## Documentation

N/A beyond the edit itself — the two description fields *are* the documentation for this change.
