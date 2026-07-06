---
name: threads
description: This skill should be used when the user asks to "show threads", "email conversations", "conversation view", "thread view", "show me the whole conversation", "threaded view", "group by subject", "show all replies", "read the whole thread", or wants to see emails grouped into conversations by subject line. Lists threads via list_threads and reads full thread context via read_thread.
triggers:
  - show threads
  - email conversations
  - conversation view
  - thread view
  - show me the whole conversation
  - threaded view
  - group by subject
  - show all replies
  - read the whole thread
---

# /email:threads - Email Threads

View and navigate email conversations grouped by subject line.

## Usage

```
/email:threads                        # List conversation threads
/email:threads 20                     # List last 20 threads (page size)
/email:threads <thread_id>            # Read all messages in a thread
```

## When Invoked (List Mode)

1. Call `list_threads` to group recent emails by normalized subject
2. Display thread table with subject, sender count, message count, latest date
3. Offer to read any thread, search within threads, or export thread

## When Invoked with Thread ID (Read Mode)

1. Call `read_thread` to fetch all messages chronologically
2. Display each message with sender, date, and body
3. Offer to reply to the thread, export the thread, or extract action items

## MCP Tools Used

- `list_threads` — group envelopes by subject line
- `read_thread` — read all messages in a thread chronologically

## Output Format (List)

```
📬 Threads (15 conversations)

| # | Subject              | Participants | Msgs | Latest     |
|---|----------------------|-------------|------|------------|
| 1 | Q1 Budget Review     | Alice, Bob  | 4    | 2h ago     |
| 2 | Project Alpha Update | pm@co, team | 8    | 1d ago     |
| 3 | Team Standup Notes   | team@co     | 12   | 1d ago     |

→ "Read #1" to see the full thread
→ "Read #3 as markdown" to export
```

## Output Format (Thread)

```
📬 Thread: Q1 Budget Review

Alice — Feb 13, 9:15 AM
---
Hi team, please review the attached budget...

Bob — Feb 13, 10:30 AM
---
Looks good. A few comments on the marketing line item...

Alice — Feb 13, 11:00 AM
---
Thanks Bob, updated. Can everyone approve by Friday?

You — Feb 13, 2:00 PM
---
Approved from my side. (via /email:reply)
```
