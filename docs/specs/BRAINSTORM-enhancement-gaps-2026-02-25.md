# BRAINSTORM: himalaya-mcp Enhancement Gaps

**Date:** 2026-02-25
**Mode:** deep feat save
**Duration:** ~10 min
**Project:** himalaya-mcp v1.3.1

## Context

Post v1.3.1 release — installation docs overhauled, Homebrew formula generator integrated, `.mcpb` packaging working. Identified gaps in skill coverage, hooks, and release tooling.

## What Already Exists

- 19 MCP tools, 7 skills, 1 agent, 0 hooks
- 4 install paths: Homebrew, Marketplace, Source, standalone MCP
- Homebrew release automation (formula + .mcpb auto-upload)
- `himalaya-mcp doctor` diagnostic CLI (6-layer check)

## What's Missing

### Skills (4 gaps)
1. **`/email:search`** — tool exists, no skill wrapper
2. **`/email:manage`** — bulk flag/move/archive, no skill
3. **`/email:config`** — no guided himalaya setup from Claude
4. **`/email:stats`** — no inbox analytics

### Hooks (3 gaps)
1. **Post-install** — auto-run `doctor` after install
2. **Session-start** — unread count notification
3. **Pre-send** — confirmation gate for send_email/compose_email

### Config (1 gap)
1. **`.craft/homebrew.json`** — craft integration for release pipeline

### Tooling (2 gaps)
1. **Release automation** — version bump + changelog scripts
2. **Zero-config install** — detect macOS mail accounts, generate config.toml

## Recommended Implementation Order

1. `/email:search` (20 min)
2. `/email:manage` (30 min)
3. Post-install hook (20 min)
4. `.craft/homebrew.json` (10 min)
5. Pre-send hook (1 hr)
6. `/email:config` (2 hr)
7. `/email:stats` (1 hr)
8. Session-start hook (1 hr)
9. Release automation (4 hr)

## Spec Generated

→ `SPEC-enhancement-gaps-2026-02-25.md`
