# Attachments and Calendar Events

**Level 2** | **Time:** 5 minutes | **Builds on:** [Read Your First Email](read-first-email.md)

---

## Part 1: Working with Attachments

### Step 1: List attachments

```
You: "What attachments does email 42 have?"
```

Claude calls `list_attachments` and shows:

```
Attachments for email 42:
- report.pdf (application/pdf, 245 KB)
- invite.ics (text/calendar, 2 KB)
- screenshot.png (image/png, 118 KB)
```

### Step 2: Download an attachment

```
You: "Download the report PDF"
```

Claude calls `download_attachment` and returns the file path:

```
Downloaded "report.pdf" to: /tmp/himalaya-mcp-abc123/report.pdf
```

The file is saved to a temporary directory. You can reference it in follow-up conversations or copy the path.

---

## Part 2: Calendar Invites

### Step 3: Extract a calendar event

When an email has an `.ics` attachment (calendar invite):

```
You: "What meeting is in email 42?"
```

Claude calls `extract_calendar_event` and parses the ICS file:

```
Event: Q2 Planning Meeting
Start: 2026-03-01T14:00:00
End: 2026-03-01T15:00:00
Location: Room 42
Organizer: alice@example.com
Description: Quarterly planning session

Use create_calendar_event to add this to Apple Calendar.
```

### Step 4: Add to Apple Calendar

```
You: "Add it to my calendar"
```

Claude shows a preview first:

```
--- CALENDAR EVENT PREVIEW (not created) ---

Event: Q2 Planning Meeting
Start: 2026-03-01T14:00:00
End: 2026-03-01T15:00:00
Location: Room 42

--- END PREVIEW ---

Create this event? (confirm to proceed)
```

After you confirm:

```
You: "Yes, create it"
```

The event is added to Apple Calendar.

!!! note "macOS only"
    Calendar event creation uses AppleScript to interact with Apple Calendar. This feature is only available on macOS.

## What you learned

- `list_attachments` shows files with MIME types and sizes
- `download_attachment` saves to a temp directory and returns the path
- `extract_calendar_event` parses ICS invites from email attachments
- `create_calendar_event` has a safety gate: preview first, then confirm
- Body parts (plain.txt, index.html) are automatically filtered from attachment listings

---

**Next:** [Automate with the Agent](automate-agent.md) | **Back to:** [Tutorials](index.md)
