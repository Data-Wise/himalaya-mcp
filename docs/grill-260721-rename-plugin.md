# Grill: SPEC-rename-plugin-email-2026-07-21

**Date:** 2026-07-21
**Topic:** Plugin rename `email` → `himalaya-mcp` (Issue #67)
**Spec:** `docs/specs/SPEC-rename-plugin-email-2026-07-21.md`

## Questions & Answers

### Q1: Phase 0 spike isolation
**Should the spike run in an isolated test profile instead of the live profile?**

- **A: Yes, use --profile flag (Recommended)** ✅
  - Pro: Zero risk to live config
  - Con: Adds 1 line to the spec
- B: No, /tmp is fine
  - Pro: Simple
  - Cor: If uninstall fails, stale entry in live config
- C: Skip the spike entirely
  - Pro: Fastest
  - Con: Hyphens may break matcher/commands — unknown risk

**Decision:** Use `--profile test-spike` for isolation. Updated spec.

---

### Q2: Version number
**Is 2.0.0 (major) overkill for a ~50-user plugin rename?**

- **A: 2.0.0 is correct (Recommended)** ✅
  - Pro: SemVer is semver. Breaking = major.
  - Con: None meaningful for this audience
- B: 1.10.0 is fine
  - Pro: Less dramatic
  - Con: Incorrect SemVer for breaking change
- C: Don't bump at all
  - Pro: Simplest
  - Con: Users get surprised by breaking changes with no version signal

**Decision:** Keep 2.0.0.

---

### Q3: Skill editing strategy
**How should 16 SKILL.md files (~80 line changes) be executed?**

- **A: Task agent per skill (Recommended)** ✅
  - Pro: Parallel, auditable, verified by grep
  - Con: Slightly more setup than sed
- B: Single sed bulk replace
  - Pro: Fastest
  - Con: Catches trigger phrases that should stay
- C: Manual file-by-file
  - Pro: Safest
  - Con: 80 min of tedious editing, fatigue-induced errors

**Decision:** Dispatch 16 parallel task agents. Updated spec.

---

### Q4: Rollback realism
**Is 'revert + re-release as 1.9.1' realistic after a 2.0.0 release?**

- **A: Rollback plan is fine (Recommended)** ✅
  - Pro: Worst-case escape hatch, not routine
  - Con: Users must downgrade manually
- B: Should be 2.0.1 instead
  - Pro: Upgrade not downgrade
  - Con: Adds complexity to the revert
- C: Remove the rollback plan
  - Pro: Simpler spec
  - Con: No escape hatch

**Decision:** Keep rollback plan as-is. It's a last resort.

---

### Q5: Aggregator revert
**What if the claude-plugins#9 revert stalls or gets forgotten?**

- **A: Add to .STATUS as next action (Recommended)** ✅
  - Pro: Tracked with deadline, visible in session
  - Con: Depends on human follow-through
- B: Do it in the same PR
  - Pro: Atomic
  - Con: Different repo — can't do that
- C: Don't revert at all
  - Pro: No extra work
  - Con: Mismatch reverses (aggregator=email, plugin=himalaya-mcp), breaks again

**Decision:** Add to .STATUS with deadline. Updated spec.

---

### Q6: Migration guide
**Is a separate migration-v2.0.md necessary alongside CHANGELOG?**

- **A: Yes, separate guide (Recommended)** ✅
  - Pro: Linkable, searchable, focused
  - Con: One more file to maintain
- B: No, CHANGELOG is enough
  - Pro: Simpler
  - Con: Wall of text, not discoverable
- C: Inline into troubleshooting.md
  - Pro: No new file
  - Con: Mixing concerns

**Decision:** Create `docs/getting-started/migration-v2.0.md`.

---

### Q7: MCP server name
**Should the .mcp.json server name also change from `himalaya` to `himalaya-mcp`?**

- A: Keep `himalaya` (Recommended)
  - Pro: Server name refers to CLI backend, not plugin identity
  - Con: Tool name has mismatched identity (`himalaya-mcp` plugin + `himalaya` server)
- **B: Rename to `himalaya-mcp`** ✅ (user override)
  - Pro: Full consistency — plugin name == server name == repo name
  - Con: More changes (matcher becomes `mcp__plugin_himalaya-mcp_himalaya-mcp`, .mcp.json updates, mcpb manifest)
- C: Rename to `email`
  - Pro: Keeps old tool names
  - Con: Defeats the purpose of the rename

**Decision:** User chose `himalaya + email`. Plugin name is `himalaya` (matches CLI binary), server name is `email` (refers to function). Tool name: `mcp__plugin_himalaya_email__*`. Spec updated throughout.

---

## Summary of spec changes from grill

1. Phase 0: Added `--profile test-spike` isolation, renamed to "verify short plugin name"
2. Phase 0: Spike now tests exact target pattern (`himalaya` + `email` server)
3. Phase 1: Added collision check for `email` server name before proceeding
4. Phase 3: Explicitly listed 16 trigger phrases that must NOT change
5. Phase 3: Added `npm test` verification after skill edits
6. Phase 4: Added grep for stale `email` refs after doc edits
7. Phase 5a: Fixed jq assertion to expect `"himalaya"` (not `"himalaya-mcp"`)
8. Phase 5b: Scoped version grep to exclude CHANGELOG.md
9. Post-merge: Added consequence of skipped aggregator revert
10. Migration notes: Added `.mcp.json` manual edit instructions
11. Regression test: Pinned to `tests/config.test.ts`
12. Acceptance criteria: Added observable user outcome + regression test
13. Why section: Clarified `himalaya` ≠ `himalaya-mcp` is intentional
14. Test plan: Added E2E smoke test (install → compose → hook → sent.log)
15. Phase 4: Expanded from 9 to 19+ files — added cookbook.md (15+ refs), skills.md (764 lines), guide.md, desktop-extension.md, 4 tutorials, migrating-from-em.md
16. Phase 4: Added explicit instruction to NOT modify CHANGELOG.md (historical entries)
17. Acceptance criteria: Added doc completeness check (19+ files, CHANGELOG preservation)
18. Phase 4: Split into 4a (large files: skills.md, cookbook.md, guide.md with dedicated agents), 4b (small files batch), 4c (verification)
19. Phase 4a: Added file-specific editing strategies for 764-line skills.md and 512-line cookbook.md
