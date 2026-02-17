# .mcpb Packaging Orchestration Plan

> **Branch:** `feature/mcpb-packaging`
> **Base:** `dev`
> **Worktree:** `~/.git-worktrees/himalaya-mcp/feature-mcpb-packaging`
> **Spec:** `docs/specs/SPEC-mcpb-packaging-2026-02-17.md`
> **Research:** `docs/bundling-research.md`

## Objective

Package himalaya-mcp as a `.mcpb` Desktop Extension for Claude Desktop one-click install. Ship a lightweight variant (~150 KB) that requires `brew install himalaya` separately.

## Phase Overview

| Phase | Task | Priority | Status |
|-------|------|----------|--------|
| 1 | Create manifest.json | High | |
| 2 | Build script (build:mcpb) | High | |
| 3 | CI validation | Medium | |
| 4 | Test in Claude Desktop | High | |
| 5 | Documentation updates | Medium | |
| 6 | Release integration | Medium | |

---

## Phase 1: Create manifest.json

**Goal:** Write the .mcpb manifest with all metadata, tools, prompts, user_config, and compatibility.

### Files to create/edit:
- `mcpb/manifest.json` — The extension manifest (see spec for full schema)

### Key decisions:
- Server type: `node` (our MCP server is Node.js)
- Entry point: `dist/index.js` (esbuild bundle)
- user_config: himalaya_binary (file, optional), himalaya_account (string, optional), himalaya_folder (string, default "INBOX")
- compatibility: `platforms: ["darwin"]`, `runtimes: { node: ">=22.0.0" }`
- Declare all 19 tools + 4 prompts statically

### Acceptance criteria:
- [ ] `npx @anthropic-ai/mcpb validate mcpb/manifest.json` passes
- [ ] All 19 tools listed with name + description
- [ ] All 4 prompts listed
- [ ] user_config fields have correct types and defaults

---

## Phase 2: Build script

**Goal:** Create `npm run build:mcpb` that assembles and packs the .mcpb file.

### Files to create/edit:
- `scripts/build-mcpb.sh` — Build script
- `package.json` — Add `build:mcpb` script
- `.mcpbignore` — Exclude patterns for packing

### Build steps:
1. Run `npm run build:bundle` (creates dist/index.js)
2. Copy `dist/index.js` to `mcpb/dist/index.js`
3. Run `npx @anthropic-ai/mcpb validate mcpb/`
4. Run `npx @anthropic-ai/mcpb pack mcpb/ himalaya-mcp-v{version}.mcpb`

### Acceptance criteria:
- [ ] `npm run build:mcpb` produces a valid .mcpb file
- [ ] .mcpb file size < 1 MB (lightweight, no binary)
- [ ] `npx @anthropic-ai/mcpb info himalaya-mcp-v*.mcpb` shows correct metadata

---

## Phase 3: CI validation

**Goal:** Add .mcpb validation to the CI pipeline.

### Files to edit:
- `.github/workflows/ci.yml` — Add mcpb validate + pack step

### CI steps to add:
```yaml
- name: Validate MCPB manifest
  run: npx @anthropic-ai/mcpb validate mcpb/
- name: Build MCPB bundle
  run: npm run build:mcpb
- name: Verify MCPB bundle
  run: npx @anthropic-ai/mcpb info himalaya-mcp-v*.mcpb
```

### Acceptance criteria:
- [ ] CI runs mcpb validation on every push/PR
- [ ] CI produces .mcpb artifact
- [ ] Validation failure blocks merge

---

## Phase 4: Test in Claude Desktop

**Goal:** Manually verify the .mcpb installs and works in Claude Desktop.

### Test plan:
1. Build .mcpb locally: `npm run build:mcpb`
2. Open Claude Desktop, install the .mcpb file
3. Verify install dialog shows user_config fields
4. Verify MCP server starts (check logs)
5. Test: "list my emails" → should call list_emails
6. Test: "triage my inbox" → should use triage_inbox prompt
7. Test with empty user_config fields (should fall back to defaults)
8. Test with custom himalaya_binary path

### Acceptance criteria:
- [ ] .mcpb installs without errors
- [ ] user_config dialog appears correctly
- [ ] All 19 tools accessible
- [ ] Empty optional fields don't break server

---

## Phase 5: Documentation updates

**Goal:** Update docs to include .mcpb as an installation method.

### Files to edit:
- `README.md` — Add .mcpb install option
- `docs/getting-started/installation.md` — Full .mcpb instructions
- `docs/guide/guide.md` — Update Claude Desktop section
- `docs/reference/architecture.md` — Add .mcpb to distribution diagram
- `docs/reference/refcard.md` — Add .mcpb install command

### Acceptance criteria:
- [ ] Installation docs list .mcpb as option alongside Homebrew/GitHub
- [ ] Claude Desktop section references .mcpb as primary method
- [ ] Architecture docs show .mcpb distribution channel

---

## Phase 6: Release integration

**Goal:** Include .mcpb in the release pipeline.

### Files to edit:
- `.github/workflows/homebrew-release.yml` — Add .mcpb to release artifacts
- `docs/specs/SPEC-mcpb-packaging-2026-02-17.md` — Update status to "implemented"

### Release steps to add:
1. Build .mcpb during release workflow
2. Upload .mcpb as GitHub Release asset
3. Include download link in release notes

### Acceptance criteria:
- [ ] `gh release create` includes .mcpb asset
- [ ] Release notes link to .mcpb download
- [ ] Users can download .mcpb from GitHub Releases page

---

## How to Start

```bash
cd ~/.git-worktrees/himalaya-mcp/feature-mcpb-packaging
claude
```

Start with **Phase 1** — create `mcpb/manifest.json`. Reference the spec at `docs/specs/SPEC-mcpb-packaging-2026-02-17.md` for the full manifest schema and field details.

## Notes

- The esbuild bundle (`dist/index.js`, ~595 KB) already includes all dependencies inline — no `node_modules` needed in the .mcpb
- Test `npx @anthropic-ai/mcpb` locally before adding to CI
- The `${__dirname}` variable resolves to the .mcpb install directory at runtime
- Empty `user_config` fields: test whether they pass `""` or are omitted from env
