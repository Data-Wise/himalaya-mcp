# Integrations

How to combine himalaya-mcp with other tools and workflows.

## Obsidian / Markdown Notes

The `export_to_markdown` + `copy_to_clipboard` pipeline makes it easy to save emails into any notes app.

```
You: "Export email 42 as markdown and save it to my Obsidian vault"
```

Claude will:

1. `export_to_markdown(id: "42")` — generate structured markdown
2. `copy_to_clipboard(text)` — copy to clipboard
3. You paste into Obsidian

For automation from a shell, note that himalaya v2 needs **two** calls — headers
live on the envelope, the body on the message, and no single subcommand returns
both (v1's `envelope get` was removed in v2):

```bash
ID=42
{
  himalaya envelope list --json --page-size 100 \
    | jq -r --arg id "$ID" '.envelopes[] | select(.id == $id)
        | "# \(.subject)\n\n**From:** \(.from[0].name // .from[0].email)\n**Date:** \(.date)\n"'
  himalaya message read "$ID" --json | jq -r '.text_body'
} > ~/vault/email-$ID.md
```

Asking Claude for `export_to_markdown` is still the easier path — it emits YAML
frontmatter plus the body in one step, with no reassembly.

## Apple Ecosystem

### Apple Calendar

`create_calendar_event` creates events directly in Apple Calendar via AppleScript. Requires macOS and Calendar app access.

```
You: "Add the meeting from email 42 to my calendar"
```

1. `extract_calendar_event(id: "42")` — parses the ICS attachment
2. Claude shows event details
3. `create_calendar_event(summary, dtstart, dtend, confirm: true)` — creates in Calendar

### Apple Reminders

You can extract action items and create reminders manually:

```
You: "Create a reminder from the action items in email 42"
```

Claude calls `create_action_item` and presents the list — you copy them into Reminders.

### Clipboard

The `copy_to_clipboard` tool works on macOS (via `pbcopy`) and Linux (via `xclip`). Use it to pipe email content anywhere:

```
You: "Export email 42 and copy it to my clipboard"
```

## Other MCP Servers

himalaya-mcp works alongside other MCP servers. In Claude Desktop, configure multiple servers in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "himalaya": {
      "command": "node",
      "args": ["/path/to/himalaya-mcp/dist/index.js"]
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem"]
    }
  }
}
```

In Claude Code, himalaya-mcp is a plugin — it coexists with other plugins and the `claude mcp add` command.

## CI/CD and Shell Scripts

You can call the MCP server from shell scripts for automation:

```bash
# Send a notification email via the MCP server
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"send_email","arguments":{"template":"Build failed","to":"team@example.com","confirm":true}}}' | node dist/index.js

# Check account health
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"health_check","arguments":{}}}' | node dist/index.js | jq '.result.content[0].text'
```

## Tips for Combining Tools

| Goal | Tools to Chain |
|------|----------------|
| Read → Save | `read_email` → `export_to_markdown` → `copy_to_clipboard` |
| Search → Review → Organize | `search_emails` → `read_email` → `flag_email` / `move_email` |
| Meeting Prep | `search_emails` → `read_thread` → `create_action_item` |
| Inbox Zero | `triage_inbox` prompt → `flag_email` → `move_email` |
| Calendar Flow | `list_attachments` → `extract_calendar_event` → `create_calendar_event` |
| Email Digest | `list_emails` → `read_email` → `export_to_markdown` → `copy_to_clipboard` |

## Related

- [User Guide](guide.md) — complete walkthrough
- [Cookbook](cookbook.md) — practical recipes
- [Architecture](../reference/architecture.md) — system design
