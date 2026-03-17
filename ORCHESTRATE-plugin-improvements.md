# Plugin Improvements v1.5.0 — Orchestration Plan

> **Branch:** `feature/plugin-improvements`
> **Base:** `dev`
> **Worktree:** `~/.git-worktrees/himalaya-mcp/feature-plugin-improvements`
> **Spec:** `docs/specs/SPEC-plugin-improvements-2026-03-17.md`
> **Theme:** "Make it work without slash commands"

## Objective

Make the himalaya-mcp plugin activate naturally from conversation (no explicit `/email:*` required), add thread/conversation view, improve Desktop parity with new MCP prompts, and fix auto-enable after Homebrew install.

---

## Phase Overview

| Phase | Task | Priority | Estimate | Status |
|-------|------|----------|----------|--------|
| 0 | Investigate himalaya thread headers | P0 | 15 min | Done |
| 1 | SessionStart hook + skill descriptions | P0 | 1 hr | Done |
| 2 | Thread view (list_threads + read_thread) | P1 | 4 hr | Done |
| 3 | Morning briefing + Desktop prompts | P1 | 2 hr | Done |
| 4 | Auto-enable fix + docs + polish | P1 | 1 hr | Done |

**Total estimate:** ~8-9 hours

---

## Phase 0: Investigate himalaya Thread Headers (15 min)

**Goal:** Determine if himalaya exposes References/In-Reply-To in JSON output. This blocks Phase 2 design.

### Steps

1. Run `himalaya envelope list --output json` on a real inbox and inspect fields
2. Run `himalaya message read <id> --output json` to check if headers are available there
3. Check if `himalaya message read <id> --raw` gives full RFC822 headers
4. Document findings — update spec Open Question #1

### Decision Gate

- If References/In-Reply-To available in envelope list → use direct grouping (fast)
- If only available in raw message → need per-message fetch (slower, paginate)
- If not available at all → fall back to subject-line threading only

---

## Phase 1: SessionStart Hook + Skill Descriptions (1 hr)

**Goal:** Make "check my email" trigger the inbox skill without explicit `/email:inbox`.

### 1a. Add SessionStart Hook (20 min)

**Files to create:**
- `himalaya-mcp-plugin/hooks/session-start.sh` — Shell script that outputs JSON with additionalContext

**Content of session-start.sh:**
```bash
#!/bin/bash
cat <<'EOF'
{"additionalContext": "Email plugin (himalaya-mcp) is active. When the user mentions email, inbox, messages, triage, or mail — use the himalaya MCP tools. Available skills: /email:inbox (check email), /email:triage (classify inbox), /email:digest (daily summary), /email:compose (new email), /email:reply (reply to email), /email:search (find emails), /email:manage (flag/move), /email:attachments (list/download), /email:stats (inbox analytics), /email:config (setup), /email:help (commands reference)."}
EOF
```

**Files to modify:**
- `himalaya-mcp-plugin/.claude-plugin/plugin.json` — Add SessionStart hook entry:
```json
"SessionStart": [{
  "hooks": [{
    "type": "command",
    "command": "${CLAUDE_PLUGIN_ROOT}/hooks/session-start.sh"
  }]
}]
```

**Tests:**
- Verify hook script outputs valid JSON
- Verify plugin.json validates

### 1b. Broaden Skill Descriptions (30 min)

**Files to modify:** All 11 `himalaya-mcp-plugin/skills/*/SKILL.md`

For each skill, expand the description to include more natural language variants:

| Skill | Add to description |
|-------|-------------------|
| inbox | "any new messages", "what's in my email", "show me my mail", "unread emails", "check messages" |
| triage | "go through my inbox", "what needs attention", "prioritize my email", "sort my messages" |
| digest | "morning briefing", "what happened overnight", "email roundup", "catch me up on email" |
| compose | "send a message to", "email someone", "write to", "new message" |
| reply | "answer that email", "get back to them", "write back", "respond to" |
| search | "look for that email from", "did I get an email about", "find message from" |
| manage | "move these emails", "flag this", "archive", "mark as read" |
| attachments | "download the file", "what files were attached", "get the attachment" |
| stats | "how many emails", "inbox count", "unread count" |
| config | "set up email", "change email account", "which email account" |
| help | "what can you do with email", "email features", "how do I use email" |

**Pattern:** Keep existing triggers, ADD new ones. Don't remove anything.

### 1c. Test (10 min)

- `npm test` — all 342 existing tests still pass
- Manual: verify hook script is executable and outputs valid JSON
- Verify plugin.json schema is valid

### Commit

```
feat: add SessionStart hook and broaden skill descriptions

- Add session-start.sh hook for email context injection
- Register SessionStart hook in plugin.json
- Expand all 11 skill descriptions with natural language triggers
- Theme: "make it work without slash commands"
```

---

## Phase 2: Thread View (4 hr)

**Goal:** Add `list_threads` and `read_thread` MCP tools for conversation grouping.

**Depends on:** Phase 0 findings (himalaya header availability)

### 2a. Thread Parser (1.5 hr)

**File to create:** `src/himalaya/thread-parser.ts`

Implementation:
- `normalizeSubject(subject: string): string` — Strip Re:/Fwd:/RE:/FW: prefixes
- `groupIntoThreads(envelopes: Envelope[]): Thread[]` — Main grouping function
  - Strategy 1 (preferred): Group by References/In-Reply-To header chains
  - Strategy 2 (fallback): Group by normalized subject
  - Build adjacency map: message_id → parent_id
  - Find connected components
  - Sort threads by latest_date descending
- `Thread` interface (see spec for schema)

**Key edge cases:**
- Emails with no References header → standalone thread (1 message)
- Circular references → break cycle, assign to earliest message
- Subject-only grouping → strip whitespace, case-insensitive compare
- Very long threads → truncate message list, keep first + last N

### 2b. Thread Tools (1.5 hr)

**File to create:** `src/tools/threads.ts`

Tools:
- `list_threads` — Fetch envelopes, group via thread-parser, return Thread[]
- `read_thread` — Given thread_id (first message ID), fetch all messages in thread chronologically

**Parameters (zod schemas):**
- list_threads: `{ folder?: string, account?: string, page_size?: number, page?: number }`
- read_thread: `{ thread_id: string, account?: string }`

### 2c. Type Extensions (15 min)

**File to modify:** `src/himalaya/types.ts`

- Add `references?: string[]` and `in_reply_to?: string` to Envelope interface
- Add `Thread` interface

### 2d. Register Tools (15 min)

**File to modify:** `src/index.ts`

- Import and register list_threads, read_thread
- Bump VERSION constant to "1.5.0"

### 2e. Tests (1 hr)

**File to create:** `tests/threads.test.ts`

Test cases (~20-25 tests):
- normalizeSubject: strips Re:, Fwd:, RE:, FW:, nested Re: Re:, preserves clean subjects
- groupIntoThreads: single message → 1 thread, reply chain → 1 thread, parallel threads → separate
- groupIntoThreads: subject-only fallback when no References
- groupIntoThreads: circular references handled
- groupIntoThreads: mixed (some with References, some without)
- list_threads tool: registration, parameter validation, calls himalaya
- read_thread tool: registration, parameter validation, returns messages in order
- Thread sorting: latest_date descending

### Commit

```
feat: add thread/conversation view (list_threads + read_thread)

- Add thread-parser.ts with References/In-Reply-To + subject-line grouping
- Add list_threads and read_thread MCP tools
- Extend Envelope type with references and in_reply_to fields
- 20+ new tests for thread grouping and tool registration
```

---

## Phase 3: Morning Briefing + Desktop Prompts (2 hr)

**Goal:** Add morning_briefing and inbox_check MCP prompts; create /email:morning skill.

### 3a. Morning Briefing Prompt (45 min)

**File to create:** `src/prompts/morning.ts`

Prompt: `morning_briefing`
- Arguments: `account?` (string)
- Instructions: Guide Claude through morning workflow:
  1. List unread emails (last 24 hours)
  2. Classify by urgency: needs-reply-today, FYI, newsletter, automated
  3. Summarize top 5 urgent (1 sentence each)
  4. Extract calendar events from invites
  5. List action items from flagged emails
  6. Present as structured briefing

### 3b. Inbox Check Prompt (30 min)

**File to create:** `src/prompts/inbox-check.ts`

Prompt: `inbox_check`
- Arguments: `account?`, `folder?`
- Instructions: Guide Claude through inbox check:
  1. List recent emails (page 1)
  2. Show unread count + total
  3. Highlight flagged/important
  4. Offer next actions (read, triage, reply)

### 3c. Morning Skill (15 min)

**File to create:** `himalaya-mcp-plugin/skills/morning/SKILL.md`

Skill: `/email:morning`
- Description: "This skill should be used when the user asks for 'morning briefing', 'what happened overnight', 'catch me up on email', 'email roundup', 'morning email summary'"
- Instructions: Invoke the morning_briefing MCP prompt, then offer follow-up actions

### 3d. Register Prompts (15 min)

**File to modify:** `src/index.ts` — Register morning_briefing and inbox_check prompts

### 3e. Tests (30 min)

**File to create:** `tests/morning.test.ts` (~10-12 tests)
- morning_briefing prompt: registration, arguments, message generation
- inbox_check prompt: registration, arguments, message generation
- Both: valid MCP prompt format, correct tool references

**File to modify:** `tests/prompts.test.ts` — Add tests for new prompts if they share the existing pattern

### Commit

```
feat: add morning briefing workflow and Desktop prompts

- Add morning_briefing MCP prompt with urgency classification
- Add inbox_check MCP prompt for Desktop parity
- Create /email:morning skill for CLI plugin
- 10+ new tests for prompt registration and format
```

---

## Phase 4: Auto-Enable Fix + Polish (1 hr)

**Goal:** Fix Homebrew post_install, update manifests, docs, and version references.

### 4a. Update mcpb/manifest.json (15 min)

- Add list_threads and read_thread to tools array
- Add morning_briefing and inbox_check to prompts array
- Bump version to 1.5.0

### 4b. Update plugin.json (10 min)

- Verify SessionStart hook is properly registered (from Phase 1)
- Add /email:morning to skills list if manifest tracks skills

### 4c. Update Documentation (20 min)

Files to update:
- `docs/guide.md` — Add thread view section, morning briefing, new prompts
- `docs/REFCARD.md` — Add new tools and prompts to quick reference
- `CHANGELOG.md` + `docs/CHANGELOG.md` — v1.5.0 entry
- `CLAUDE.md` — Update tool count (19→21), prompt count (4→6), skill count (11→12), test count
- `.STATUS` — Update version, test counts, "Just Completed" section

### 4d. Version Bump (10 min)

All files per version bump checklist (see MEMORY.md):
- `package.json` + `package-lock.json`
- `.claude-plugin/marketplace.json`
- `mcpb/manifest.json`
- `himalaya-mcp-plugin/.claude-plugin/plugin.json`
- `src/index.ts` VERSION constant
- `tests/e2e.test.ts` version assertion

### 4e. Final Test Run (10 min)

- `npm test` — All tests pass (target: 382-402)
- `npm run build:bundle` — Bundle still < 1 MB
- `npm run build:mcpb` — .mcpb builds and validates

### Commit

```
chore: update manifests, docs, and version for v1.5.0

- Bump version to 1.5.0 across all files
- Update mcpb manifest with new tools and prompts
- Update guide, refcard, changelog, CLAUDE.md, .STATUS
- Final test count: XXX
```

---

## Acceptance Criteria

- [ ] "Check my email" triggers inbox listing without `/email:inbox` (SessionStart hook + broadened descriptions)
- [ ] "Triage my inbox" triggers triage without `/email:triage`
- [ ] `list_threads` groups related emails by conversation
- [ ] `read_thread` shows all messages in a thread chronologically
- [ ] `morning_briefing` prompt produces structured urgency-classified briefing
- [ ] `inbox_check` prompt works in Claude Desktop
- [ ] `/email:morning` skill available in Claude Code
- [ ] All 342+ existing tests pass
- [ ] 40-60 new tests added (target: 382-402 total)
- [ ] Bundle size < 1 MB
- [ ] .mcpb builds and validates

---

## How to Start

```bash
cd ~/.git-worktrees/himalaya-mcp/feature-plugin-improvements
claude
```

Then: Start with **Phase 0** (investigate himalaya headers) — it's 15 minutes and unblocks the thread view design.
