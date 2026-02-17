# Troubleshooting

Common issues and solutions for himalaya-mcp.

---

## himalaya CLI Issues

### "himalaya: command not found"

The himalaya binary isn't in your PATH.

**Fix:**

```bash
# Install via Homebrew
brew install himalaya

# Verify
which himalaya
himalaya --version
```

If installed but not found, set the full path in your MCP config:

```json
{
  "env": {
    "HIMALAYA_BINARY": "/opt/homebrew/bin/himalaya"
  }
}
```

### "No account found"

himalaya needs at least one configured email account.

**Fix:**

Create `~/.config/himalaya/config.toml`:

```toml
[accounts.personal]
default = true
email = "you@example.com"
display-name = "Your Name"

backend.type = "imap"
backend.host = "imap.example.com"
backend.port = 993
backend.encryption = "tls"
backend.login = "you@example.com"
backend.passwd.cmd = "security find-generic-password -s 'himalaya-personal' -w"

message.send.backend.type = "smtp"
message.send.backend.host = "smtp.example.com"
message.send.backend.port = 465
message.send.backend.encryption = "tls"
message.send.backend.login = "you@example.com"
message.send.backend.passwd.cmd = "security find-generic-password -s 'himalaya-personal' -w"
```

See the [himalaya docs](https://github.com/pimalaya/himalaya) for provider-specific setup (Gmail, Fastmail, etc.).

### "Authentication failed"

Your password or app-specific password is incorrect.

**Fix for Gmail:**

1. Enable 2FA on your Google account
2. Generate an app password at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Store it in your keychain:
   ```bash
   security add-generic-password -s 'himalaya-gmail' -a 'you@gmail.com' -w 'your-app-password'
   ```
4. Reference it in config: `passwd.cmd = "security find-generic-password -s 'himalaya-gmail' -w"`

### "Connection timed out"

The IMAP/SMTP server is unreachable.

**Fix:**

- Check your internet connection
- Verify host and port in your himalaya config
- Try increasing the timeout:
  ```json
  { "env": { "HIMALAYA_TIMEOUT": "60000" } }
  ```
- Some networks block IMAP port 993 -- try a different network

---

## MCP Server Issues

### "Server not responding" in Claude Code

The MCP server process may have crashed.

**Fix:**

```bash
# Test the server directly
node dist/index.js

# If it fails, rebuild
npm run build && node dist/index.js
```

### "Tool not found" errors

The server is running but tools aren't registered.

**Fix:**

1. Rebuild: `npm run build`
2. Restart Claude Code
3. Verify the plugin path is correct:
   ```bash
   ls -la ~/.claude/plugins/himalaya-mcp
   ```

### Plugin not loading

**Check the symlink:**

```bash
ls -la ~/.claude/plugins/himalaya-mcp
# Should point to your himalaya-mcp directory
```

**Check the plugin manifest:**

```bash
cat ~/.claude/plugins/himalaya-mcp/.claude-plugin/plugin.json
```

**Rebuild if needed:**

```bash
cd ~/projects/dev-tools/himalaya-mcp
npm run build
```

---

## Email Issues

### Empty search results

himalaya's search syntax is specific. Common mistakes:

| Wrong | Right | Why |
|-------|-------|-----|
| `from: alice` | `from alice` | No colon in himalaya syntax |
| `"subject invoice"` | `subject invoice` | No quotes needed |
| `from=alice` | `from alice` | Use space, not equals |

**Correct syntax:**

```
subject budget                    -- subject contains "budget"
from alice                        -- sender contains "alice"
from alice and subject budget     -- both conditions
not flag Seen                     -- unread emails
after 2026-02-01                  -- after a date
```

### Wrong folder names

Folder names are provider-specific:

| Provider | Trash | Spam | Sent | Archive |
|----------|-------|------|------|---------|
| Gmail | `[Gmail]/Trash` | `[Gmail]/Spam` | `[Gmail]/Sent Mail` | `[Gmail]/All Mail` |
| Fastmail | `Trash` | `Junk Mail` | `Sent` | `Archive` |
| Generic IMAP | `Trash` | `Spam` | `Sent` | `Archive` |

**Find your folders:**

```
You: "List my email folders"
```

Claude calls the `email://folders` resource.

### HTML emails show as empty

Some emails are HTML-only with no plain text version.

**Fix:** Use `read_email_html` instead of `read_email`:

```
You: "Show me the HTML version of email 42"
```

### Pagination not working

The `page` parameter starts at 1, not 0:

```
list_emails(page_size: 10, page: 1)   -- first 10
list_emails(page_size: 10, page: 2)   -- next 10
```

---

## Desktop Extension Issues

### "himalaya CLI not found" in Claude Desktop

Claude Desktop doesn't inherit your shell's PATH. The himalaya binary at `/opt/homebrew/bin/himalaya` isn't visible to the extension.

**Fix:**

1. Run `himalaya-mcp doctor --fix` -- this auto-sets `himalaya_binary` in Desktop settings
2. Or manually set the binary path in the extension settings:
   - Open `~/Library/Application Support/Claude/Claude Extensions Settings/himalaya-mcp.json`
   - Set `"himalaya_binary": "/opt/homebrew/bin/himalaya"` in `userConfig`

### Unresolved `${user_config.*}` template variables

If optional fields (himalaya_binary, himalaya_account, himalaya_folder) are left empty during install, Claude Desktop passes literal `${user_config.himalaya_binary}` strings instead of empty values.

**Fix:** This is handled automatically since v1.2.1 -- the config loader ignores any value starting with `${`. If you're on an older version, upgrade the extension.

### Extension not showing tools

1. Run `himalaya-mcp doctor` to check extension status
2. Verify the extension is enabled in Claude Desktop settings
3. Restart Claude Desktop after installing or updating the extension

### Extension install path

Extensions are stored at:

```
~/Library/Application Support/Claude/Claude Extensions/himalaya-mcp/
```

Registry: `~/Library/Application Support/Claude/extensions-installations.json`
Settings: `~/Library/Application Support/Claude/Claude Extensions Settings/himalaya-mcp.json`

---

## Common Error Messages

| Error | Cause | Fix |
|-------|-------|-----|
| `himalaya exited with code 1` | CLI command failed | Check himalaya config, try the command manually |
| `ETIMEOUT` | Server connection timeout | Increase `HIMALAYA_TIMEOUT`, check network |
| `JSON parse error` | Unexpected CLI output | Rebuild (`npm run build`), update himalaya |
| `spawn himalaya ENOENT` | Binary not found | Set `HIMALAYA_BINARY` env var to full path |
| `No such folder` | Invalid folder name | Use `email://folders` to list valid names |

---

## Getting Help

- **himalaya CLI:** [github.com/pimalaya/himalaya](https://github.com/pimalaya/himalaya)
- **himalaya-mcp:** [github.com/Data-Wise/himalaya-mcp/issues](https://github.com/Data-Wise/himalaya-mcp/issues)
- **MCP Protocol:** [modelcontextprotocol.io](https://modelcontextprotocol.io/)

### Run doctor

The fastest way to diagnose issues:

```bash
himalaya-mcp doctor          # Check everything
himalaya-mcp doctor --fix    # Auto-fix what it can
himalaya-mcp doctor --json   # Machine-readable output
```

Doctor checks: Node.js, himalaya binary, himalaya config, MCP server bundle, email connectivity, Desktop extension (install, registry, settings, user_config), Claude Code plugin (symlink, marketplace), and environment variables.

### Debug mode

Run the MCP server with debug output:

```bash
DEBUG=* node dist/index.js
```

### Run tests to verify installation

```bash
npm test    # 314 tests
```
