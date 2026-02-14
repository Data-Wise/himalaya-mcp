# Triage Your Inbox

**Level 2** | **Time:** 5 minutes | **Builds on:** [Read Your First Email](read-first-email.md)

---

## Step 1: Start triage

```
You: "Triage my last 10 emails"
```

Claude reads each email and classifies them into three categories:

- **Actionable** -- needs a reply or follow-up
- **Informational** -- worth knowing, no action needed
- **Skip** -- newsletters, promotions, noise

## Step 2: Review the results

Claude presents a table like:

```
| ID     | From           | Subject          | Class        | Action          |
|--------|----------------|------------------|--------------|-----------------|
| 249088 | alice@work.com | Q1 Budget Review | Actionable   | Reply by Friday |
| 249064 | newsletter@... | Weekly Digest    | Skip         | Archive         |
| 249051 | boss@work.com  | Meeting Tomorrow | Actionable   | Flag + prepare  |
```

## Step 3: Approve actions

Claude asks what to do. You can:

- **Accept all:** "Yes, do it"
- **Cherry-pick:** "Flag the two actionable ones, but keep the newsletter"
- **Skip:** "Don't make any changes"

## Step 4: Flag and organize

If you approve, Claude executes:

```
flag_email(id: "249088", flags: ["Flagged"], action: "add")
flag_email(id: "249051", flags: ["Flagged"], action: "add")
move_email(id: "249064", target_folder: "Archive")
```

## What you learned

- Triage classifies emails into actionable categories
- Claude always asks before making changes
- Flags and moves are the primary organization tools

---

**Next:** [Reply to an Email](reply-email.md) | **Back to:** [Tutorials](index.md)
