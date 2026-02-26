# Plugin Skills & Agent

When installed as a Claude Code plugin, the email plugin provides 11 slash commands (skills), 1 autonomous agent, and 1 hook.

## Skills vs Tools

| Layer | What | How to use | Example |
|-------|------|-----------|---------|
| **Skills** | High-level workflows | Say the command or natural language | `/email:inbox` or "check my inbox" |
| **Tools** | Atomic operations | Claude calls them automatically | `list_emails(page_size: 10)` |
| **Prompts** | AI guidance templates | Referenced by skills and tools | `triage_inbox` prompt |

Skills orchestrate multiple tools. When you say `/email:triage`, the skill instructs Claude to call `list_emails`, then `read_email` on each, then classify results.

---

## /email:inbox

Check your inbox and list recent emails.

**Triggers:** "check email", "inbox", "read email", "my emails"

**What it does:**

1. Calls `list_emails` to fetch recent envelopes (default: last 10)
2. Presents a summary table with sender, subject, date, and flags
3. Offers to read, triage, or reply to specific emails

**Example:**

```
You: /email:inbox

Claude:
Found 5 emails in INBOX:

| ID     | From              | Subject              | Date       | Flags   |
|--------|-------------------|----------------------|------------|---------|
| 249088 | alice@work.com    | Q1 Budget Review     | 2026-02-13 | Seen    |
| 249064 | bob@team.com      | Sprint Retro Notes   | 2026-02-13 |         |
| 249051 | boss@work.com     | Meeting Tomorrow     | 2026-02-12 | Flagged |

Would you like me to:
- Read any of these emails?
- Triage your inbox?
- Reply to one?
```

**Options:**

- Specify a count: "Check my last 20 emails"
- Specify a folder: "Check my Sent folder"
- Specify an account: "Check my work inbox"

---

## /email:triage

AI-powered email classification. Reads each email and sorts into actionable categories.

**Triggers:** "triage email", "classify email", "sort email", "organize inbox"

**What it does:**

1. Calls `list_emails` to fetch recent emails (configurable count)
2. Reads each email with `read_email`
3. Classifies into **Actionable** / **Informational** / **Skip**
4. Suggests specific actions (reply, flag, archive, etc.)
5. Presents a decision table
6. Waits for your approval before making any changes

**Example:**

```
You: /email:triage

Claude:
Triaging last 10 emails...

| ID     | From           | Subject              | Class        | Suggested Action     |
|--------|----------------|----------------------|--------------|----------------------|
| 249088 | alice@work.com | Q1 Budget Review     | Actionable   | Reply needed by Fri  |
| 249064 | newsletter@... | Weekly Digest        | Skip         | Archive              |
| 249051 | boss@work.com  | Meeting Tomorrow     | Actionable   | Flag + prepare       |
| 249045 | hr@company.com | Benefits Update      | Informational| Mark read            |

Shall I:
1. Flag the 2 actionable emails?
2. Archive the newsletter?
3. Mark the HR email as read?
```

**Key behavior:**

- Never acts without confirmation
- Groups similar actions (flag all actionable, archive all skippable)
- Provides reasoning for each classification

---

## /email:digest

Generate a daily priority digest in markdown format.

**Triggers:** "email digest", "daily digest", "email summary", "morning briefing"

**What it does:**

1. Fetches today's emails (or configurable date range)
2. Reads and analyzes each email
3. Groups by priority: Requires Action / FYI / Low Priority
4. Generates a markdown digest with one-line summaries
5. Includes stats (total, action needed, FYI, low priority)

**Example output:**

```markdown
# Email Digest -- 2026-02-13

## Requires Action (2)
- **Q1 Budget Review** from Alice -- needs approval by Friday
- **Meeting Tomorrow** from Boss -- bring Q4 slides

## FYI / Review (3)
- **Sprint Retro Notes** from Bob -- action items from yesterday
- **Benefits Update** from HR -- open enrollment ends Feb 28
- **Server Maintenance** from DevOps -- scheduled downtime Saturday

## Low Priority (4)
- **Weekly Newsletter** from DevWeekly
- **GitHub Notifications** (3 PRs merged)

---
Stats: 9 emails | 2 action | 3 FYI | 4 low
```

**Options:**

- Export: "Export my digest as markdown"
- Clipboard: "Copy the digest to my clipboard"
- Date range: "Digest for the last 3 days"

---

## /email:reply

Draft and send email replies with safety confirmation.

**Triggers:** "reply to email", "respond to email", "draft reply"

**What it does:**

1. Reads the original email with `read_email`
2. Generates a draft reply with `draft_reply`
3. Shows the full draft for your review
4. Accepts edits ("make it shorter", "add that I'll be late")
5. Only sends after your explicit confirmation

**Example:**

```
You: /email:reply 249088

Claude:
Reading email 249088 from Alice...

Subject: Q1 Budget Review

Here's a draft reply:

---
Hi Alice,

Thanks for sharing the Q1 budget review. I've looked through the
numbers and have a few questions:

1. The marketing line item seems higher than projected -- is this
   due to the new campaign?
2. Can we schedule 30 minutes to discuss the engineering allocation?

Happy to chat anytime this week.

Best,
[Your name]
---

Want me to:
- Send this as-is?
- Make changes? (e.g., "make it more formal", "add a deadline")
- Cancel?
```

**Tone options:**

| Tone | When to use |
|------|-------------|
| `professional` | Default. Business communication |
| `casual` | Friends, close colleagues |
| `brief` | Quick acknowledgments |
| `detailed` | Complex topics needing explanation |

**Safety guarantees:**

- Draft is always shown before sending
- "Send" requires explicit confirmation
- You can revise unlimited times
- "Cancel" stops the workflow entirely

---

## /email:search

Search emails by keyword, sender, flags, or date.

**Triggers:** "search email", "find email", "look for email", "email from", "email about"

**What it does:**

1. Parses user query into himalaya filter syntax (`from:`, `subject:`, `--unread`, `--flagged`, dates)
2. Calls `search_emails` MCP tool
3. Formats results as a table: ID, From, Subject, Date, Flags
4. Offers to read, refine, or triage results

**Example:**

```
You: /email:search from:alice meeting

Claude:
Found 3 emails matching "from:alice meeting":

| ID     | From           | Subject                  | Date       | Flags |
|--------|----------------|--------------------------|------------|-------|
| 249088 | alice@work.com | Q1 Budget Review Meeting | 2026-02-13 | Seen  |
| 248972 | alice@work.com | Meeting Tomorrow         | 2026-02-10 |       |
| 248901 | alice@work.com | Re: Weekly Meeting Notes | 2026-02-07 | Seen  |

Would you like me to:
- Read any of these emails?
- Refine the search?
- Triage these results?
```

**Options:**

- Combine filters: "emails from alice about budget flagged"
- Unread only: "unread emails from boss"
- Flagged: "flagged emails this week"
- Date hints: "emails about invoices from last month"

---

## /email:manage

Bulk email operations -- flag, unflag, move, archive.

**Triggers:** "manage email", "bulk email", "move emails", "flag emails", "archive emails"

**What it does:**

1. Parses action (flag / unflag / move / archive) and target list (comma-separated IDs or `all-unread`)
2. Shows a confirmation gate for operations affecting more than 5 emails
3. Executes operations in sequence with a progress display
4. Reports a summary when complete

**Example:**

```
You: /email:manage move 1,2,3 Archive

Claude:
Moving 3 emails to Archive...

  [1/3] 249088 -- moved
  [2/3] 249064 -- moved
  [3/3] 249051 -- moved

Done. 3 emails moved to Archive.
```

**Safety:**

- Confirmation required for operations affecting more than 5 emails
- Never deletes emails -- moves to Trash only
- All moves are reversible (move back from Trash or Archive)

---

## /email:stats

Inbox statistics -- unread count, top senders, trends.

**Triggers:** "email stats", "inbox stats", "email analytics", "how many unread"

**What it does:**

1. Calls `list_emails` and `search_emails` to gather data
2. Computes unread count, today's email count, top senders, and oldest unread email
3. Displays a stats block with optional weekly trend comparison

**Example output:**

```
Inbox Stats -- 2026-02-13

  Unread:        14
  Today:          5
  Oldest unread:  2026-02-01 (from devops@company.com)

  Top senders (last 30 days):
    1. github@github.com      -- 42 emails
    2. alice@work.com         -- 18 emails
    3. newsletter@devweekly   -- 12 emails
```

**Options:**

- `--weekly` to include a trend comparison vs. last week
- `--folder Sent` to run stats on a specific folder

---

## /email:config

Setup wizard for email configuration.

**Triggers:** "email config", "email setup", "configure email", "himalaya setup"

**What it does:**

1. Checks that the himalaya CLI is installed
2. Checks that a config file exists at `~/.config/himalaya/config.toml`
3. Runs an interactive setup with provider templates (Gmail, Outlook, Fastmail, custom IMAP)
4. Tests the connection
5. Runs `himalaya-mcp doctor` to verify everything is working

**Modes:**

| Mode | Usage |
|------|-------|
| Wizard (default) | `/email:config` |
| Validate existing config | `/email:config --check` |
| Add another account | `/email:config --add-account` |

**Example:**

```
You: /email:config

Claude:
Email Setup Wizard

Step 1/5  Checking himalaya CLI...   installed (v1.0.0)
Step 2/5  Checking config file...    not found

Let's create one. Which email provider?
  1. Gmail
  2. Outlook / Microsoft 365
  3. Fastmail
  4. Custom IMAP/SMTP

You: 1

Step 3/5  Gmail setup
  IMAP host:  imap.gmail.com:993 (SSL)
  SMTP host:  smtp.gmail.com:587 (STARTTLS)
  Email address: you@gmail.com
  Auth:       App password (recommended)

Step 4/5  Testing connection...      OK
Step 5/5  Running doctor check...    All checks passed

Setup complete. Try /email:inbox to check your mail.
```

---

## /email:help

Help hub for the email plugin. Browse all available tools, prompts, resources, and workflows.

**Triggers:** "email help", "himalaya help", "email commands", "what can you do with email"

**Views:**

| Command | Shows |
|---------|-------|
| `/email:help` | Overview of all capabilities |
| `/email:help tools` | All 19 MCP tools with parameters |
| `/email:help prompts` | All 4 MCP prompts |
| `/email:help resources` | All 3 MCP resources |
| `/email:help workflows` | Common email workflow patterns |
| `/email:help quick` | One-page quick reference |
| `/email:help [tool-name]` | Detailed help for a specific tool |

**Example:**

```
You: /email:help

Claude:
┌──────────────────────────────────────────────┐
│  Email Help                                  │
│  Privacy-first email for Claude              │
├──────────────────────────────────────────────┤
│                                              │
│  Skills:                                     │
│    /email:inbox        Check your inbox      │
│    /email:triage       Classify emails       │
│    /email:digest       Daily summary         │
│    /email:reply        Draft & send safely   │
│    /email:compose      Compose new emails    │
│    /email:attachments  Files & calendar      │
│    /email:help         This help             │
│                                              │
│  Quick actions:                              │
│    "Check my inbox"                          │
│    "Triage my last 20 emails"                │
│    "Reply to email 42"                       │
│    "Export email 42 as markdown"             │
│    "Find emails from alice about budget"     │
│                                              │
│  Type /email:help [topic] for details        │
└──────────────────────────────────────────────┘
```

---

## Email Assistant Agent

The email-assistant is an autonomous agent that can process your entire inbox with minimal interaction.

**Triggers:** "handle my email", "process inbox", "email workflow"

**What it does:**

1. **Scan** -- lists unread emails
2. **Classify** -- triages each email
3. **Summarize** -- one-sentence summary per email
4. **Act** -- drafts replies, extracts todos, suggests flags/moves
5. **Report** -- generates a digest with stats

**Safety rules:**

- Never sends email without your explicit confirmation
- Never deletes (only flags or moves)
- Never accesses other accounts without permission
- Asks before bulk operations on 5+ emails
- All actions are reversible (unflag, move back)

**Example session:**

```
You: "Handle my email"

Claude (email-assistant agent):
Scanning inbox... found 12 unread emails.

Reading and classifying...

Summary:
- 3 emails need replies (Alice, Boss, Client)
- 4 are FYI (team updates, CI notifications)
- 5 are low priority (newsletters, promotions)

Suggested actions:
1. Draft replies for the 3 actionable emails
2. Mark 4 FYI emails as read
3. Archive 5 low-priority emails

Shall I proceed with these actions? I'll show each
draft before sending.
```

The agent is best for batch processing when you have many emails to work through. For individual emails, the skills are faster.

---

## Plugin Hooks

The plugin includes a pre-send confirmation hook that provides an additional safety layer.

### Pre-Send Confirmation

**Event:** PreToolUse (on `send_email` and `compose_email`)

When you send an email with `confirm=true`, the hook shows a preview on stderr before the MCP tool's own safety gate processes the request:

```
📧 ─── Email Send Preview ───────────────────────
  To:      alice@example.com
  Subject: Meeting tomorrow
  ─────────────────────────────────────────────
  Hi Alice,
  Just confirming our meeting...
  ─────────────────────────────────────────────
```

The hook also logs all sends to `~/.himalaya-mcp/sent.log` for audit purposes.

---

## Choosing Between Skills and Natural Language

Both approaches work. Skills provide structured workflows; natural language is more flexible.

| Want to... | Skill | Natural language |
|-----------|-------|-----------------|
| Check inbox | `/email:inbox` | "What's in my inbox?" |
| Triage | `/email:triage` | "Organize my last 20 emails" |
| Daily summary | `/email:digest` | "Give me today's email digest" |
| Reply | `/email:reply 42` | "Reply to that email from Alice" |
| Search | `/email:search` | "Find emails about the project deadline" |
| Export | (no skill) | "Export email 42 as markdown" |
| Bulk actions | `/email:manage` | "Archive all newsletters" |
| Inbox stats | `/email:stats` | "How many unread emails?" |
| Setup email | `/email:config` | "Configure my email" |
| Full processing | (agent) | "Handle my email" |

Natural language can combine operations: "Find the budget email from Alice, summarize it, and draft a reply saying I approve." Skills are for when you want a predictable, structured workflow.
