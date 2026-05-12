# Troubleshooting

When himalaya-mcp tools fail, this guide helps you diagnose and fix the most common issues.

## How to read doctor output

Run `himalaya-mcp doctor` to see per-account health. Each account row shows:

- **Account name** — from `~/.config/himalaya/config.toml`
- **Reachable** — whether himalaya could connect and list folders
- **Last error** — error code from the last failure (e.g., `imap_auth_failed`)
- **Hint** — one-line suggestion for the next step

If any account fails, doctor's footer points here.

## Common failure modes

### 1. Expired app password (`imap_auth_failed`)

**Symptom:** `list_emails` or any read operation fails. Error envelope `code: imap_auth_failed`.

**Cause:** Gmail/iCloud/Outlook app passwords expire or get revoked. The stored password no longer authenticates.

**Fix:**

1. Generate a new app password in your email provider's security settings.
2. Run `himalaya account configure <account>` and paste the new password.
3. Verify: `himalaya-mcp doctor --account <account>`.

### 2. Network restrictions / VPN required (`transient` after retry)

**Symptom:** Tools intermittently fail with `code: transient` and `attempts: 2`. Often happens on corporate or campus networks.

**Cause:** IMAP port (993) blocked, VPN required, or DNS issues.

**Fix:**

1. Test from a terminal: `himalaya envelope list -a <account>`.
2. If that also fails, confirm you can reach `imap.your-provider.com:993` (e.g., `nc -vz imap.gmail.com 993`).
3. Connect VPN if your network requires it.

### 3. Certificate trust issues (`imap_cert_error`)

**Symptom:** Error envelope `code: imap_cert_error`. Usually first run after a system reinstall or with self-hosted mail servers.

**Fix:**

1. For self-signed certificates, set `imap-encryption-tls.insecure = true` in your himalaya account config (NOT recommended for production).
2. For valid certs not trusted by your system, install the CA into the system trust store.

### 4. Missing or corrupt himalaya config (`himalaya_config_missing`)

**Symptom:** Every tool fails with `code: himalaya_config_missing`.

**Fix:**

1. Run `himalaya account configure` to walk through account setup.
2. Verify the config exists at `~/.config/himalaya/config.toml`.
3. Re-run `himalaya-mcp doctor`.

### 5. Account renamed or removed (`account_not_found`)

**Symptom:** Tool calls with `--account <name>` fail with `code: account_not_found`.

**Fix:**

1. List configured accounts: `himalaya account list`.
2. Either use a valid account name, or re-add the missing account with `himalaya account configure <name>`.

## Asking Claude for help

When a tool fails, ask Claude one of:

- "Run a health check on my email accounts."
- "Why is email failing?"
- "Check if my <account> account is working."

Claude will invoke the `health_check` MCP tool and use the structured response to suggest a fix.

## Error code reference

| Code | Recoverable? | Typical fix |
|------|--------------|-------------|
| `imap_auth_failed` | Yes | Re-run `himalaya account configure` |
| `imap_cert_error` | Yes | Trust the cert or set `insecure = true` |
| `imap_timeout` | Yes | Check network / VPN |
| `transient` | Yes | Auto-retried; check network if persistent |
| `account_not_found` | Yes | `himalaya account list` to see configured names |
| `folder_not_found` | Yes | `himalaya folder list` |
| `message_not_found` | Yes | UID may be stale; refresh inbox |
| `himalaya_not_installed` | Yes | `brew install himalaya` |
| `himalaya_config_missing` | Yes | `himalaya account configure` |
| `unknown` | Maybe | See `rawStderr` field; file a GitHub issue if reproducible |

## When to file an issue

If you see `code: unknown` reproducibly, or a documented error code with no matching fix, please file an issue at <https://github.com/Data-Wise/himalaya-mcp/issues> with:

- The error envelope (redact email content)
- `himalaya-mcp doctor` output
- `himalaya --version` and your OS
