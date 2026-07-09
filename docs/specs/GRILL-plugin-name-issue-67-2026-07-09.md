# GRILL — Plugin Name Divergence (Issue #67)

**Date:** 2026-07-09
**Target:** GitHub issue [#67](https://github.com/Data-Wise/himalaya-mcp/issues/67) — "marketplace: plugin name 'email' (in subdir) doesn't match repo identity 'himalaya-mcp' — breaks aggregator resolution"
**Prior spec:** none (no existing BRAINSTORM/SPEC for this slug to cross-link)
**Mode:** topic-scoped grill, refined via prompt-refiner, unbounded (stopped at 5 branches, milestone checkpoint → wrap up)
**Reopened (session 2):** goal changed from "close #67 cheaply" to "fix the underlying class of bug forever, for any Data-Wise plugin" — following an `idea-refine` session (`docs/ideas/aggregator-sync-reusable-workflow.md`) that found craft already has an unwired name-mismatch check (`verify-surfaces.sh`, built specifically after #67) and a version-drift precedent (`craft#218`: 4 repos drifted independently from N copy-pasted sync workflows). Decision 4 (scope boundary) is reopened below; decision 1 (rename) is reaffirmed with a new, independently decisive reason.

## Refined prompt

> Grill the plan to rename himalaya-mcp's plugin identifier from `email` to `himalaya-mcp`
> (closing GitHub issue #67) — covering plugin.json, marketplace.json, every doc referencing
> `claude plugin install email`, and a migration path for existing installs — then produce a
> plan formatted for /craft:orch:drive.

## Codebase evidence (pre-answer sweep)

- `himalaya-mcp-plugin/.claude-plugin/plugin.json`: `name: "email"`; `PreToolUse` hook
  `matcher: "mcp__plugin_email_himalaya"` gates the **pre-send safety confirmation** for
  `send_email`/`compose_email` (`pre-send.sh`).
- `.claude-plugin/marketplace.json`: `plugins[0].name: "email"`, `source: "./himalaya-mcp-plugin"`.
- 10 hardcoded `mcp__plugin_email_himalaya__*` assertions in `tests/dogfood.test.ts`.
- 9 doc files reference `claude plugin install email` (README, CLAUDE.md, CHANGELOG,
  docs/index.md, troubleshooting.md, packaging.md, installation.md, quickstart.md,
  architecture.md, cheat-sheet.md).
- Issue #67 was already worked around at the aggregator level (`claude-plugins#9`, renamed the
  aggregator entry to `email`) — the acute failure is already mitigated; this is a durability fix,
  not an active outage.

## Decision ledger

### 1. Rename vs. document (riskiest assumption / silent failure)

**Decision: Do NOT rename. Document the divergence instead** (issue #67's option 2).
**Reaffirmed in session 2 (reopened) with a second, independently decisive reason.**

Original reasoning: renaming `email` → `himalaya-mcp` would change the MCP tool-name prefix
(`mcp__plugin_email_himalaya__*` → `mcp__plugin_himalaya-mcp_himalaya__*`), which the pre-send
safety-gate hook matcher in `plugin.json` is hardcoded to. An unrenamed matcher would silently
stop firing the send-confirmation gate — no error, no test failure, emails just stop being
gated. This alone was fixable engineering (update matcher + tests + a regression test), not a
hard blocker.

**Session 2 finding — the decisive reason:** the plugin name determines the skill/command
namespace prefix. All 16 user-facing commands (`/email:inbox`, `/email:compose`, `/email:reply`,
`/email:search`, `/email:triage`, `/email:manage`, `/email:morning`, `/email:digest`,
`/email:export`, `/email:forward`, `/email:threads`, `/email:attachments`, `/email:stats`,
`/email:config`, `/email:help`, `/email:respond`) would become `/himalaya-mcp:*` — a permanent
UX regression on every command a user types daily, to satisfy aggregator tooling that never
surfaces the command name to begin with. The people who'd benefit from the rename (aggregator
resolution logic) never see the command names; the people who'd be hurt by it (every user,
every day) see nothing else. This is decisive on its own, independent of the matcher risk.

### 2. Where the documentation lives

**Decision: inline in `plugin.json` + `marketplace.json`**, not in `CLAUDE.md`/CONTRIBUTING.
Closest to where a future editor of those files would actually look — the exact failure mode
that created #67 was an undocumented divergence nobody saw at edit time.

### 3. JSON encoding mechanism

**Decision: extend the existing `description` field** in both files (append a clause, e.g.
"...wrapping himalaya CLI. Plugin id is 'email' by design — see issue #67."), not a
non-standard `_comment` key. Zero schema-validation risk; `description` is already a free-text
field both the plugin loader and marketplace loader expect.

### 4. Scope boundary — craft#218 and the reusable-workflow "forever fix"

**Original decision:** himalaya-mcp only; the cross-cutting ask (craft's aggregator-sync tooling
should validate aggregator-entry-name == source-repo plugin-name) stays entirely in `craft#218`.

**Session 2 (reopened):** explored going cross-repo — a single reusable `workflow_call` in craft
(`aggregator-sync-reusable.yml`) that every satellite repo consumes, wiring craft's already-built
but unwired name-mismatch check (`verify-surfaces.sh`) as a hard release-time gate. This is the
actual structural fix for "never recurs, for any plugin."

**Riskiest assumption surfaced:** craft's GitHub App token minting runs inside craft's own
workflow today; a `workflow_call` from himalaya-mcp doesn't automatically inherit that
cross-repo grant — unverified, could be a hard blocker.

**Decision: PARKED, not abandoned.** Craft itself is mid-refactor; building cross-repo CI
infrastructure against a repo that's actively changing shape is premature. **himalaya-mcp stays
scoped to the doc-only fix now**; the reusable-workflow idea (`docs/ideas/aggregator-sync-reusable-workflow.md`)
is the recorded design for later, to be picked up once craft's refactor lands. This is not a
final "no" on the systemic fix — it's a sequencing call given an active dependency.

### 5. Execution path

**Decision: direct edit on `dev` + PR**, no worktree. The change is an existing-file edit (no
new code files) in a repo whose branch-protection table already allows that directly on `dev`;
a full feature-branch/worktree flow would be more ceremony than a two-field description edit
warrants.

## Open questions

- **Parked, revisit later:** the reusable-workflow cross-repo auth spike (decision 4) — do this
  once craft's refactor stabilizes, not now.
- Exact wording of the description-field addition and the issue-closing comment were left to
  drafting time, not interrogated further, per the session-1 "wrap up now" checkpoint choice.

## Handoff

→ `/craft:orch:drive` with `docs/specs/SPEC-plugin-name-issue-67-2026-07-09.md` (unchanged,
single-phase, 2-file doc edit + PR — the "forever fix" is deliberately not part of this drive
run; it's parked per decision 4 above).
