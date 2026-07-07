# Migrating from `em` to himalaya-mcp

Both `em` (flow-cli's email dispatcher) and himalaya-mcp wrap the same himalaya CLI backend. They serve different interfaces: `em` is a terminal-native email client with fzf, `$EDITOR`, and interactive workflows; himalaya-mcp is a conversational email interface where Claude is the assistant.

You can use both side by side — they share the same config file (`~/.config/himalaya/config.toml`).

## Command Map

| `em` command | himalaya-mcp equivalent | Notes |
|-------------|------------------------|-------|
| `em` / `em dash` | "Claude, check my inbox" | Uses `inbox_check` prompt |
| `em inbox [N]` | "List my last N emails" | Uses `list_emails` |
| `em read <ID>` / `em <ID>` | "Read email ID" | Uses `read_email` |
| `em read --html <ID>` | "Show the HTML version" | Uses `read_email_html` |
| `em read --md <ID>` | "Show email as markdown" | Uses `render_email` |
| `em read --raw <ID>` | "Show raw source of email" | Uses `read_email_raw` |
| `em send` | "Send Alice an email..." | Two-phase: preview then confirm |
| `em reply <ID>` | "Reply to email ID saying..." | Uses `draft_reply` + `send_email` |
| `em forward <ID>` | "Forward email ID to..." | Uses `/email:forward` skill |
| `em find <query>` | "Search emails for query" | Uses `search_emails` |
| `em unread` | "How many unread emails?" | Uses `get_unread_count` |
| `em delete <ID>` | "Move email 42 to trash" | Uses `move_email` |
| `em move <ID> <F>` | "Move email 42 to Folder" | Uses `move_email` |
| `em flag <ID>` / `em star <ID>` | "Flag/star email 42" | Uses `flag_email` |
| `em unflag <ID>` | "Unflag email 42" | Uses `flag_email(action: remove)` |
| `em starred` | "Show my starred emails" | Uses `list_starred` |
| `em thread <ID>` | "Show conversation thread" | Uses `read_thread` |
| `em folders` | "List my folders" | Uses `list_folders` |
| `em create-folder <n>` | "Create a folder called..." | Uses `create_folder` |
| `em delete-folder <n>` | "Delete folder..." | Uses `delete_folder` |
| `em attach list <ID>` | "What attachments in email ID?" | Uses `list_attachments` |
| `em attach get <ID> <f>` | "Download the attachment" | Uses `download_attachment` |
| `em todo <ID>` | "Extract action items from email ID" | Uses `create_action_item` |
| `em snooze <ID> <T>` | "Snooze email 42 until..." | Uses `snooze_email` |
| `em snoozed` | "Show my snoozed emails" | Uses `list_snoozed_emails` |
| `em calendar <ID>` | "Extract calendar invite from email ID" | Uses `extract_calendar_event` |
| `em digest` | "Give me a daily digest" | Uses `daily_email_digest` prompt |
| `em digest --week` | "Give me a weekly digest" | Uses `weekly_email_digest` prompt |
| `em respond` | "Draft replies for all my actionable emails" | Uses `/email:respond` skill |
| `em doctor` | "Run a health check" | Uses `health_check` tool or CLI `himalaya-mcp doctor` |
| `em classify <ID>` | "Triage my inbox" | Uses `triage_inbox` prompt |
| `em summarize <ID>` | "Summarize email ID" | Uses `summarize_email` prompt |

## What Doesn't Port

| `em` feature | Why not in himalaya-mcp |
|-------------|------------------------|
| `em pick` (fzf) | Terminal browser; Claude's list+search replaces it |
| `em watch` (IMAP IDLE) | No background-process model in MCP |
| `em ai` / `em ai gemini` | Claude IS the AI; no backend switching |
| `em cache` | Internal AI cache detail |
| `em send --force` | Violates two-phase safety gate |
| `em delete --purge` | Permanent deletion is provider-specific |
| `em --force` flags | All two-phase operations require explicit confirmation |

## Safety Model Comparison

Both `em` and himalaya-mcp use a two-phase safety gate:

| Operation | `em` | himalaya-mcp |
|-----------|------|-------------|
| Send email | Preview → [y/N/e] | `compose_email` → preview → `send_email(confirm: true)` |
| Delete folder | Type-to-confirm | `delete_folder` → preview → `delete_folder(confirm: true)` |
| Skip preview | `--force` flag | Not supported — intentional |

## Environment Variables

| `em` variable | himalaya-mcp variable | Description |
|--------------|----------------------|-------------|
| `FLOW_EMAIL_AI` | (N/A) | Claude is the AI backend |
| `FLOW_EMAIL_PAGE_SIZE` | (use tool param) | Page size is a tool parameter |
| `FLOW_EMAIL_FOLDER` | `HIMALAYA_FOLDER` | Default folder |
| `FLOW_EMAIL_TRASH_FOLDER` | (use `getTrashFolder` utility) | Provider-agnostic trash folder |
| `FLOW_EMAIL_AI_TIMEOUT` | `HIMALAYA_TIMEOUT` | Command timeout |
| `EDITOR` | (N/A) | Claude reads emails directly |
