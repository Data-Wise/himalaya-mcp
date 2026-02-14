# Homebrew Release Workflow Orchestration Plan

> **Branch:** `feature/homebrew-release`
> **Base:** `dev`
> **Worktree:** `~/.git-worktrees/himalaya-mcp/feature-homebrew-release`

## Objective

Add automated Homebrew formula update workflow that triggers when a GitHub release is published, matching the pattern used by craft, scholar, atlas, and other Data-Wise projects.

## Context

- Formula already exists: `homebrew-tap/Formula/himalaya-mcp.rb` (currently at v1.1.0, project at v1.1.1)
- Reusable workflow exists: `homebrew-tap/.github/workflows/update-formula.yml`
- All other projects have `homebrew-release.yml` — himalaya-mcp is the only one missing it
- Simpler than craft (no dynamic metadata counts needed)

## Phase Overview

| Phase | Task | Priority | Status |
| ----- | ---- | -------- | ------ |
| 1 | Create `.github/workflows/homebrew-release.yml` | High | Pending |
| 2 | Verify `HOMEBREW_TAP_GITHUB_TOKEN` secret exists in repo | High | Pending |
| 3 | Test with `workflow_dispatch` (manual trigger for v1.1.1) | Medium | Pending |

## Implementation Details

### Phase 1: Create Workflow File

**File:** `.github/workflows/homebrew-release.yml`

**Jobs:**
1. **validate** — Checkout, determine version, check package.json matches tag, build + test + bundle
2. **prepare** — Download tarball, compute SHA256, output version + sha256
3. **update-homebrew** — Call reusable `update-formula.yml@main` with formula_name=himalaya-mcp

**Triggers:**
- `release: types: [published]` — automatic on GitHub release
- `workflow_dispatch` — manual with version + auto_merge inputs

### Phase 2: Verify Secret

- Confirm `HOMEBREW_TAP_GITHUB_TOKEN` exists in himalaya-mcp repo settings
- This is a PAT with repo access to `Data-Wise/homebrew-tap`

### Phase 3: Test

- Run `workflow_dispatch` manually for v1.1.1 to update the formula from v1.1.0 → v1.1.1
- Verify formula SHA256 and version are correct after update

## Acceptance Criteria

- [ ] `homebrew-release.yml` follows same pattern as craft/scholar/atlas
- [ ] Workflow validates version consistency before releasing
- [ ] Workflow computes SHA256 and calls reusable update-formula
- [ ] CI passes on the PR
- [ ] Manual test with workflow_dispatch succeeds (optional, post-merge)

## How to Start

```bash
cd ~/.git-worktrees/himalaya-mcp/feature-homebrew-release
claude
```

Then create `.github/workflows/homebrew-release.yml` with the content from the planning session.
