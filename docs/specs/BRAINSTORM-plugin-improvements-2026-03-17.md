# BRAINSTORM: Improving the Claude CLI + Desktop Plugin

**Date:** 2026-03-17
**Mode:** feature | Depth: max | Duration: ~6 min
**Agents Used:** skill-trigger-analyzer, plugin-ux-researcher

---

## Context

himalaya-mcp v1.4.1 ships 19 MCP tools, 4 prompts, 3 resources, 11 skills, 1 agent, 1 hook.
All four pain points confirmed: skills don't trigger naturally, missing workflows, Desktop is limited, setup has friction.
Optimizing for: power-user (plugin author) workflow.

---

## Agent Findings Summary

### Agent 1: Skill Trigger Analysis

- All 11 skills use "This skill should be used when..." pattern with 54 total trigger phrases
- **Triggers frontmatter is metadata-only** — Claude reads `description` for matching, not `triggers`
- Descriptions are well-written but too narrow (e.g., "check email" works, "any new messages" doesn't)
- No overlap issues between skills — each has distinct intent
- The `email-assistant` agent has broader trigger phrases but agents spawn subprocesses (heavier)

### Agent 2: Plugin UX Research

- **SessionStart hook exists** — can inject email context at session start (game-changer)
- `disable-model-invocation` frontmatter controls whether Claude can auto-invoke (but has open bug #22345)
- Multi-step workflows belong in skills, not agents (cheaper, same conversation context)
- Desktop .mcpb gap covered by MCP prompts — add more to mirror high-value skills
- Auto-enable after install is buggy (Issue #17832) — need settings.json patch workaround
- Hook types available: SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Stop

---

## Quick Wins (< 30 min each)

### QW1: SessionStart Hook — Inject Email Context

**Impact: HIGH** — This alone may fix the "skills don't trigger" problem.

Add a SessionStart hook that tells Claude the email plugin exists:

```json
{
  "hooks": {
    "SessionStart": [{
      "hooks": [{
        "type": "command",
        "command": "echo '{\"additionalContext\": \"Email plugin is active. When user mentions email, inbox, messages, or triage — use the himalaya MCP tools (list_emails, search_emails, read_email, etc.). Available skills: /email:inbox, /email:triage, /email:digest, /email:compose, /email:reply, /email:search, /email:manage, /email:attachments, /email:stats, /email:config, /email:help.\"}'"
      }]
    }]
  }
}
```

**Why it works:** Currently Claude doesn't know the email plugin exists until you invoke a skill. A SessionStart hook puts email tools in Claude's awareness from the first message.

### QW2: Broaden Skill Descriptions with Natural Language Variants

Expand each skill's description to include more conversational triggers:

| Skill | Current triggers | Add these |
|-------|-----------------|-----------|
| inbox | "check email", "inbox", "read email" | "any new messages", "what's in my email", "show me my mail", "unread emails" |
| triage | "triage email", "classify email" | "go through my inbox", "what needs attention", "prioritize my email" |
| digest | "email digest", "daily digest" | "morning briefing", "what happened overnight", "email roundup" |
| compose | "compose email", "write email" | "send a message to", "email someone", "write to" |
| reply | "reply to email", "respond to" | "answer that email", "get back to them", "write back" |
| search | "search email", "find email" | "look for that email from", "did I get an email about" |

### QW3: Add `user-invocable: false` to Trigger-Only Skills

Stats and help don't need slash-command entries — make them model-invocable only so they fire from natural language without cluttering the skill menu:

```yaml
# stats/SKILL.md
user-invocable: false  # Claude triggers when user asks "how many unread"
```

### QW4: Fix Auto-Enable in Homebrew post_install

Patch `settings.json` directly as workaround for Issue #17832:

```bash
# In post_install, after symlink + marketplace add:
SETTINGS="$HOME/.claude/settings.json"
if [ -f "$SETTINGS" ]; then
  # Add "email" to enabledPlugins if not present
  node -e "
    const s = require('$SETTINGS');
    s.enabledPlugins = s.enabledPlugins || [];
    if (!s.enabledPlugins.includes('email')) s.enabledPlugins.push('email');
    require('fs').writeFileSync('$SETTINGS', JSON.stringify(s, null, 2));
  "
fi
```

---

## Medium Effort (1-4 hours each)

### ME1: Thread/Conversation View Tool

**#1 user wish.** Group related emails by conversation.

**Approach:** New MCP tool `list_threads` that:
1. Calls `himalaya envelope list` with `--output json`
2. Groups by `In-Reply-To` / `References` headers (or subject-line threading as fallback)
3. Returns thread objects: `{ thread_id, subject, participants, message_count, latest_date, messages: [...] }`

**Challenges:**
- himalaya CLI doesn't natively expose `References` header — may need `himalaya message read --raw` to parse headers
- Subject-line threading is fuzzy (strips "Re:", "Fwd:" prefixes)
- Could be expensive for large inboxes — need pagination

**New tools:**
- `list_threads` — List email threads in folder (grouped by conversation)
- `read_thread` — Read all messages in a thread sequentially

### ME2: Morning Briefing Workflow (Enhanced Digest Skill)

Upgrade `/email:digest` into a comprehensive morning workflow:

1. Check inbox (unread count, flagged count)
2. Classify by urgency: needs-reply-today, FYI, newsletter, automated
3. Summarize top 5 urgent emails (1-sentence each)
4. Extract calendar events from any invites
5. List action items from flagged emails
6. Present as structured briefing

**New skill:** `/email:morning` (or enhance existing digest)

### ME3: Batch Reply Workflow

New skill `/email:batch-reply`:
1. List emails needing reply (flagged + unanswered)
2. For each: show summary, draft reply, present for approval
3. Queue approved replies for sending
4. Send all at once (or one-by-one with confirmation)

**Safety:** Each reply goes through existing two-phase safety gate.

### ME4: Add 2-3 More MCP Prompts for Desktop Parity

Desktop users only have 4 prompts. Add:

| New Prompt | Mirrors Skill | Purpose |
|------------|---------------|---------|
| `inbox_check` | /email:inbox | Guide Claude through inbox listing + summary |
| `batch_reply` | /email:batch-reply | Multi-email reply workflow |
| `morning_briefing` | /email:morning | Full morning email workflow |

These give Desktop users the same guided workflows that CLI plugin users get via skills.

### ME5: UserPromptSubmit Hook for Email Intent Detection

Add a `UserPromptSubmit` hook that detects email-related intent and enriches the prompt:

```json
{
  "hooks": {
    "UserPromptSubmit": [{
      "hooks": [{
        "type": "prompt",
        "prompt": "If the user's message is about email (checking, reading, sending, searching), suggest using the appropriate /email:* skill. If not about email, respond with empty string."
      }]
    }]
  }
}
```

**Caution:** This fires on EVERY prompt — needs to be fast and bail quickly for non-email messages.

---

## Long-term (Future sessions, 4+ hours)

### LT1: Smart Auto-Triage on Session Start

A `SessionStart` agent-type hook that:
1. Checks inbox (lightweight — count only, < 2s)
2. If unread > 0, injects summary: "You have 7 unread emails (2 urgent)"
3. Offers: "Want me to triage?" in additionalContext

**Risk:** Adds latency to every session start. Should be opt-in via config.

### LT2: Email Templates / Saved Replies

Store reusable reply templates:
- `~/.himalaya-mcp/templates/` directory
- Each template: YAML frontmatter (name, tags, tone) + body
- New tool: `list_templates`, `apply_template`
- Compose/reply skills offer matching templates

### LT3: Obsidian / Apple Notes Export Adapter

New adapters alongside existing clipboard.ts:
- `obsidian.ts` — Export email to Obsidian vault as markdown note (with YAML frontmatter, tags, links)
- `apple-notes.ts` — Export to Apple Notes via AppleScript (like existing calendar adapter)

### LT4: Desktop Extension Safety Improvements

Since hooks don't work in .mcpb, enhance tool-level safety:
- Embed confirmation language in `send_email` tool description
- Add `compose_email` description guidance for preview-before-send
- Consider a `confirm_action` tool that Desktop Claude calls before destructive ops

### LT5: Plugin Settings UI

Expose plugin configuration through a `config` resource or tool:
- Current account, default folder, himalaya binary path
- Template directory path
- SessionStart behavior (auto-check inbox: on/off)
- Thread view settings (group by references vs subject)

---

## Trade-offs Matrix

| Feature | Impact | Effort | Risk | Priority |
|---------|--------|--------|------|----------|
| QW1: SessionStart hook | HIGH | 30 min | Low | P0 |
| QW2: Broaden descriptions | HIGH | 30 min | Low | P0 |
| QW3: user-invocable flags | LOW | 15 min | Low | P2 |
| QW4: Auto-enable fix | MED | 30 min | Med (fragile) | P1 |
| ME1: Thread view | HIGH | 4 hr | Med (header parsing) | P1 |
| ME2: Morning briefing | MED | 2 hr | Low | P1 |
| ME3: Batch reply | MED | 3 hr | Med (safety) | P2 |
| ME4: Desktop prompts | MED | 1 hr | Low | P1 |
| ME5: UserPromptSubmit | MED | 2 hr | Med (perf) | P2 |
| LT1: Auto-triage | MED | 4 hr | High (latency) | P3 |
| LT2: Templates | LOW | 4 hr | Low | P3 |
| LT3: Obsidian/Notes | MED | 6 hr | Med | P3 |
| LT4: Desktop safety | MED | 2 hr | Low | P2 |
| LT5: Plugin settings | LOW | 3 hr | Low | P3 |

---

## Recommended Path

### v1.5.0 Scope (Recommended)

**Theme: "Make it work without slash commands"**

1. **QW1: SessionStart hook** — Inject email context so Claude knows about the plugin (30 min)
2. **QW2: Broaden skill descriptions** — More natural language triggers (30 min)
3. **ME1: Thread/conversation view** — #1 user wish, new `list_threads` + `read_thread` tools (4 hr)
4. **ME2: Morning briefing** — Enhanced digest skill with urgency classification (2 hr)
5. **ME4: Desktop prompts** — Add `inbox_check` + `morning_briefing` prompts (1 hr)
6. **QW4: Auto-enable fix** — Patch settings.json in post_install (30 min)

**Total estimate:** ~8-9 hours across 6 items
**Test delta:** +40-60 tests (thread parsing, new tools, new prompts, hook tests)

### v1.6.0 Scope (Future)

- ME3: Batch reply workflow
- ME5: UserPromptSubmit hook
- LT2: Email templates
- LT3: Obsidian export

---

## Open Questions

1. **himalaya thread support** — Does `himalaya envelope list` expose `In-Reply-To` / `References` headers? Or do we need `message read --raw` for each email? (Performance concern for thread grouping)
2. **SessionStart latency** — Should the hook be `command` (fast, static context) or `prompt` (smart, but slower)? Start with `command`, upgrade later.
3. **Desktop prompt UX** — How do Claude Desktop users discover and invoke MCP prompts? Is it a menu? A @ mention? Need to test this.
4. **himalaya v1.2.0 compatibility** — Thread grouping by References header may not be available. Need to check JSON output fields.

---

**Saved:** `docs/specs/BRAINSTORM-plugin-improvements-2026-03-17.md`
