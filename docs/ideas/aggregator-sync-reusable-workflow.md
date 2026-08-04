# One Reusable Aggregator-Sync Workflow (Instead of N Copies)

> **Status: PARKED (2026-07-09).** Craft is mid-refactor; building cross-repo CI against a
> repo that's actively changing shape is premature. Revisit once craft's refactor stabilizes —
> starting with the cross-repo GitHub App auth spike under "Key Assumptions" below, which is
> the one most likely to be a hard blocker. See `GRILL-plugin-name-issue-67-2026-07-09.md`
> decision 4 for the reopened-grill context that led to parking this.

## Problem Statement

How might we ensure a Claude Code plugin's declared name and version never silently diverge
from what the Data-Wise aggregator (`Data-Wise/claude-plugins`) believes, for any plugin,
permanently — instead of re-discovering the same drift bug independently in every repo?

## Recommended Direction

Replace each satellite repo's own copy-pasted `aggregator-sync.yml` (himalaya-mcp, scholar,
rforge each maintain a near-identical file) with a single reusable workflow hosted in `craft`
(`Data-Wise/craft/.github/workflows/aggregator-sync-reusable.yml`, invoked via `workflow_call`),
following the same pattern this ecosystem already trusts for Homebrew releases.

This isn't new tooling — it's assembly of tooling craft already built. `verify-surfaces.sh`
already has a name-mismatch check (`resolve_aggregator()`, added specifically after
himalaya-mcp#67: *"a wrong name in the aggregator is as bad as wrong version"*), but nothing
invokes it — himalaya-mcp's own workflow previously bypassed it entirely and hardcoded
`PLUGIN_NAME` as a manually-maintained YAML constant. The reusable workflow should (a)
derive the plugin name from `plugin.json` at runtime instead of a hardcoded constant, and (b)
actually call `verify-surfaces.sh --aggregator-file` so the existing BLOCK check fires.

The underlying pattern this fixes is bigger than one bug: issue #218 found 4 repos (craft,
scholar, rforge, himalaya-mcp) had independently drifted from the aggregator by different
amounts — because each had its own copy of "the same" sync logic, silently diverging from each
other. One shared, versioned workflow collapses that to a single artifact; a future fix changes
one file instead of re-patching N repos again.

## Key Assumptions to Validate

- [ ] **Cross-repo permissions work.** Craft's GitHub App token minting (`create-github-app-token`)
      currently runs inside craft's own workflow. Confirm a `workflow_call` from himalaya-mcp (or
      any satellite repo) can actually invoke this reusable workflow with the right secrets —
      GitHub reusable workflows don't automatically inherit the calling App's cross-repo grants;
      the caller repo needs its own `secrets: inherit` or explicit secret passthrough. Spike this
      on one repo before committing to a full migration.
- [ ] **Wiring the name-check won't immediately self-block himalaya-mcp.** `email` ≠ `himalaya-mcp`
      is a known, accepted divergence (see the doc-only SPEC for issue #67, already drafted). If
      the hard BLOCK check goes live before that divergence is marked "acknowledged" somewhere the
      check can read, the very next himalaya-mcp release fails its own release gate. Test: wire the
      check in dry-run/warn mode first against himalaya-mcp's real aggregator entry and confirm it
      flags `email` — then confirm the acknowledgment mechanism actually suppresses it.
- [ ] **Dogfooding order matters.** Prove the reusable-workflow mechanics (checkout, cross-repo
      PR, App token) on `craft` itself first — craft's own plugin name already matches its repo
      name, so it's the lowest-risk place to validate plumbing before any name-mismatch logic is
      even in play.

## MVP Scope

**In:**
1. Ship the already-drafted SPEC (`SPEC-plugin-name-issue-67-2026-07-09.md`) first — documents
   the `email` divergence, closes #67, independent of this idea.
2. Build `aggregator-sync-reusable.yml` in craft: `workflow_call`, inputs limited to a
   plugin-path/repo identifier, internally reads `plugin.json.name` at runtime (no hardcoded
   constant), calls `verify-surfaces.sh --aggregator-file` as a hard gate.
3. An "acknowledged divergence" marker the name-check treats as satisfied — exact location (in
   `plugin.json` vs. the aggregator's own entry) is an open question below, not decided yet.
4. Migrate `craft`'s own `aggregator-sync.yml` to call the reusable workflow (dogfood, lowest
   risk, proves the plumbing).
5. Migrate `himalaya-mcp` to the reusable workflow, with the acknowledgment marker already in
   place so it doesn't self-block on its next release.

**Out (see Not Doing):** scholar/rforge migration, PR-time checks, source-of-truth-flip registry
redesign, repo-scaffold-time prevention.

## Not Doing (and Why)

- **Migrating scholar and rforge in this same effort** — separate follow-up PRs once the
  craft→himalaya-mcp path is proven; keeps blast radius to one repo at a time.
- **Flipping the source of truth so the aggregator registry is authoritative** (a bigger,
  unproven direction) — the reusable workflow already collapses the "N copies drift
  independently" failure mode without a schema/registry migration. Revisit only if the
  reusable-workflow approach itself turns out insufficient.
- **Repo-scaffold-time prevention** (asserting `plugin.json.name == repo name` when a *new*
  plugin repo is created) — a different lifecycle stage (prevents new instances vs. fixes
  existing drift); a real idea, but a separate ideation session, not bundled into this one.
- **A PR-time required-status-check version of the name-mismatch check** — release-time (via the
  reusable workflow) is sufficient for the MVP; PR-time is optional hardening on top, not core.

## Open Questions

- Can craft's GitHub App actually be granted cross-repo `workflow_call` access from himalaya-mcp
  (and eventually scholar/rforge), or does each caller repo need its own token-minting step
  duplicated inside the reusable workflow's permission model? Needs a spike, not a guess.
- Where should the "acknowledged divergence" marker live — `plugin.json` (co-located with the
  name itself) or the aggregator's own `marketplace.json` entry (so the aggregator is the single
  place asserting "yes, this mismatch is expected")? Depends on how the issue #67 SPEC's
  description-field note is phrased — reconcile once both pieces of work exist side by side.
- This implementation work is entirely in `craft`'s domain (a different repo, different
  `CLAUDE.md`, different branch workflow) even though this ideation session ran inside
  himalaya-mcp — should the actual build happen in a craft session instead of continuing here?
