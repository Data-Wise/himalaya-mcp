# em Commands Porting — Orchestration Plan (Phase 1)

> **Branch:** `feature/port-em-commands-p1`
> **Base:** `dev`
> **Worktree:** `~/.git-worktrees/himalaya-mcp/feature-port-em-commands-p1`
> **Spec:** `docs/specs/PLAN-port-em-commands-to-himalaya-mcp.md`

## Objective

Add 4 new MCP tools (`get_unread_count`, `read_email_raw`, `render_email`, `list_starred`), a provider-agnostic `getTrashFolder()` utility, and a count-sync test. This ports the highest-value flow-cli `em` commands that have no existing MCP counterpart.

## Phase Overview

| Phase | Increment | Priority | Effort | Status |
|-------|-----------|----------|--------|--------|
| P1.1 | Trash folder utility | High | Small | ⬜ |
| P1.2 | `get_unread_count` tool | High | Small | ⬜ |
| P1.3 | `read_email_raw` tool | High | Small | ⬜ |
| P1.4 | `render_email` tool | High | Medium | ⬜ |
| P1.5 | `list_starred` tool | High | Small | ⬜ |
| P1.6 | Count-sync test | High | Small | ⬜ |
| P1.7 | Docs per tool | High | Medium | ⬜ |

## Phase 1.1: Trash folder utility
**Scope:** Build `getTrashFolder(account)` helper in `src/himalaya/` that returns the correct trash folder name per email provider (Gmail: `[Gmail]/Trash`, Exchange/Outlook: `Deleted Items`, others: `Trash`).
- [ ] 1.1.1 Create `src/himalaya/trash.ts` with `getTrashFolder(account)` function
- [ ] 1.1.2 Add tests for Gmail, Exchange, Fastmail fallback, unknown provider
- [ ] 1.1.3 Export from index and verify import chain
**Key files:** `src/himalaya/trash.ts` (NEW), `src/himalaya/index.ts` (update)

## Phase 1.2: `get_unread_count` MCP tool
**Scope:** Add tool that returns unread count per folder/account by querying himalaya envelope list with flag filter.
- [ ] 1.2.1 Create `src/tools/unread.ts` with tool registration
- [ ] 1.2.2 Register in `src/index.ts`
- [ ] 1.2.3 Add tests: happy path, empty inbox, error handling
**Key files:** `src/tools/unread.ts` (NEW), `src/index.ts` (update)

## Phase 1.3: `read_email_raw` MCP tool
**Scope:** Add tool that returns raw MIME source of an email. Verify himalaya supports `message get --raw` or equivalent.
- [ ] 1.3.1 Verify himalaya `message get --raw` flag works
- [ ] 1.3.2 Create `src/tools/read-raw.ts` with tool registration
- [ ] 1.3.3 Register in `src/index.ts`
- [ ] 1.3.4 Add tests: raw output, ID not found, error handling
**Key files:** `src/tools/read-raw.ts` (NEW), `src/index.ts` (update)

## Phase 1.4: `render_email` MCP tool
**Scope:** Add tool that takes an email ID and returns the body rendered as clean markdown (HTML→markdown conversion). Use a lightweight npm package (no pandoc dependency).
- [ ] 1.4.1 Install `node-html-markdown` or equivalent in `package.json`
- [ ] 1.4.2 Create `src/tools/render.ts` with HTML→markdown conversion and tool registration
- [ ] 1.4.3 Register in `src/index.ts`
- [ ] 1.4.4 Add tests: HTML email, plain text fallback, error handling
**Key files:** `src/tools/render.ts` (NEW), `src/index.ts` (update), `package.json` (update)

## Phase 1.5: `list_starred` MCP tool
**Scope:** Add convenience tool that returns all flagged/starred emails. Thin wrapper over `search_emails(flag Flagged)`.
- [ ] 1.5.1 Create `src/tools/list-starred.ts` with tool registration
- [ ] 1.5.2 Register in `src/index.ts`
- [ ] 1.5.3 Add tests: starred emails, no starred emails, error handling
**Key files:** `src/tools/list-starred.ts` (NEW), `src/index.ts` (update)

## Phase 1.6: Count-sync test
**Scope:** Add a test that asserts the registered MCP tool count matches a single source-of-truth constant, preventing drift between code and docs.
- [ ] 1.6.1 Export `TOOL_COUNT` constant from `src/index.ts`
- [ ] 1.6.2 Create test that verifies registered tool count matches constant
- [ ] 1.6.3 Update docs to reference the constant (future-proofing)
**Key files:** `src/index.ts` (update), `tests/count-sync.test.ts` (NEW)

## Phase 1.7: Docs per tool
**Scope:** Update docs for each new tool: `docs/reference/commands.md`, `docs/reference/cheat-sheet.md`, `docs/CLAUDE.md`, `docs/index.md`.
- [ ] 1.7.1 Add tool references to `commands.md`
- [ ] 1.7.2 Add tool entries to `cheat-sheet.md`; update tool count to 27
- [ ] 1.7.3 Update `CLAUDE.md` tool count and tables
- [ ] 1.7.4 Update `docs/index.md` tool count in grid cards
- [ ] 1.7.5 Run `mkdocs build --strict` to verify
**Key files:** `docs/reference/commands.md`, `docs/reference/cheat-sheet.md`, `CLAUDE.md`, `docs/index.md`, `mkdocs.yml`

## Friction Prevention

- Verify himalaya `--raw` flag before implementing read_email_raw
- If `node-html-markdown` has ESM/CJS issues, fall back to `he` + regex-based HTML stripping
- Run `npm test` after each phase to catch regressions early
- Run `mkdocs build --strict` after docs updates

## Acceptance Criteria

- [ ] `get_unread_count` returns unread count for specified folder/account
- [ ] `read_email_raw` returns raw MIME source (or verified unsupported → document)
- [ ] `render_email` converts HTML email to clean markdown
- [ ] `list_starred` returns only flagged emails
- [ ] `getTrashFolder()` returns correct folder name per provider
- [ ] Count-sync test fails if registered tool count ≠ expected constant
- [ ] All existing 507 tests still pass
- [ ] `mkdocs build --strict` passes
- [ ] Tool count updated in all doc locations

## Commit Strategy

Conventional commits per phase:
- `feat: add getTrashFolder() utility`
- `feat: add get_unread_count MCP tool`
- `feat: add read_email_raw MCP tool`
- `feat: add render_email MCP tool (HTML→markdown)`
- `feat: add list_starred MCP tool`
- `test: add count-sync test for tool count drift`
- `docs: update tool references for 4 new tools`

## Verification

```bash
npm test                    # All tests pass
mkdocs build --strict       # Docs build clean
```

## Session Instructions

```bash
cd ~/.git-worktrees/himalaya-mcp/feature-port-em-commands-p1
opencode
> "Read ORCHESTRATE-port-em-commands-p1.md and start Phase 1."
```
