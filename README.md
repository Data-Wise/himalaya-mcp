# himalaya-mcp

Privacy-first email for Claude -- MCP server and Claude Code plugin (`email`) wrapping the [himalaya](https://github.com/pimalaya/himalaya) CLI.

## Features

- **29 MCP tools**: list, search, read, flag, move, compose, draft reply, send (with safety gate), export, action items, clipboard, folders, attachments, calendar, threads, health check, get_unread_count, read_email_raw, render_email, list_starred, create_reminder, snooze_email, list_snoozed_emails
- **7 MCP prompts**: triage inbox, summarize email, daily digest, weekly digest, draft reply, morning briefing, inbox check
- **3 MCP resources**: inbox, message by ID, folders
- **16 plugin skills**: `/himalaya:inbox`, `/himalaya:triage`, `/himalaya:digest`, `/himalaya:reply`, `/himalaya:compose`, `/himalaya:attachments`, `/himalaya:search`, `/himalaya:manage`, `/himalaya:stats`, `/himalaya:config`, `/himalaya:help`, `/himalaya:morning`, `/himalaya:forward`, `/himalaya:export`, `/himalaya:threads`, `/himalaya:respond`
- **Multi-account**: per-call account switching via `--account`
- **Reliability**: account-aware diagnostics via the `health_check` tool and multi-account `doctor`; structured error envelopes with one-line fix hints
- **Safe subprocess**: uses `execFile` (no shell injection)
- **Two-phase send**: `send_email` returns preview first, requires explicit `confirm=true`
- **Env-based config**: `HIMALAYA_BINARY`, `HIMALAYA_ACCOUNT`, `HIMALAYA_FOLDER`, `HIMALAYA_TIMEOUT`

## Install

### Homebrew (recommended)

```bash
brew tap data-wise/tap
brew install himalaya-mcp
```

Installs himalaya CLI + Node.js as dependencies, auto-symlinks plugin to `~/.claude/plugins/`.

```bash
himalaya-mcp doctor    # Verify installation
```

### Claude Code Plugin (from GitHub)

**Prerequisites:** Node.js 22+ and himalaya CLI must be installed separately (`brew install node himalaya`).

```bash
claude plugin marketplace add Data-Wise/himalaya-mcp
claude plugin install himalaya
```

```bash
himalaya-mcp doctor    # Verify installation
```

### Claude Desktop (.mcpb -- one-click install)

Download `himalaya-mcp-v{version}.mcpb` from [GitHub Releases](https://github.com/Data-Wise/himalaya-mcp/releases) and open it in Claude Desktop. Requires `brew install himalaya` separately -- the `.mcpb` does not bundle the himalaya CLI.

### Claude Desktop (CLI setup)

```bash
himalaya-mcp setup
```

### Development (from source)

```bash
npm install
npm run build
ln -s ~/projects/dev-tools/himalaya-mcp ~/.claude/plugins/himalaya-mcp
```

```bash
himalaya-mcp doctor    # Verify installation
```

## Prerequisites

- [himalaya CLI](https://github.com/pimalaya/himalaya) configured with at least one email account in `~/.config/himalaya/config.toml`
- Node.js 22+ (installed automatically by Homebrew)

## Testing

```bash
npm test              # 619 tests across 33 files (vitest)
```

| Category | Tests | Coverage |
|----------|-------|----------|
| Unit (parser, client, config, clipboard) | 41 | Core parsing, config, template variable guards |
| Integration (tools, prompts) | 85 | Tool registration, MCP prompts, account validation |
| Reliability (errors, retry, accounts, health) | 33 | Error envelope, transient retry, multi-account discovery, health_check |
| v1.5.0 features | 79 | Threads (30), morning/inbox prompts (13), E2E integration (36) |
| Dogfooding | 162 | Realistic Claude usage + reliability scenarios + .mcpb validation |
| E2E | 39 | Full MCP server pipeline + structured envelope round-trip + .mcpb build pipeline |
| Setup CLI | 45 | Setup, install/upgrade E2E, multi-account doctor, plugin structure, --help/--version |

## Documentation

Full documentation at **[data-wise.github.io/himalaya-mcp](https://data-wise.github.io/himalaya-mcp/)**

- [Installation](https://data-wise.github.io/himalaya-mcp/getting-started/installation/)
- [Quick Start](https://data-wise.github.io/himalaya-mcp/getting-started/quickstart/)
- [Tutorials](https://data-wise.github.io/himalaya-mcp/tutorials/)
- [User Guide](https://data-wise.github.io/himalaya-mcp/guide/guide/)
- [MCP Tools Reference](https://data-wise.github.io/himalaya-mcp/reference/commands/)
- [Cheat Sheet](https://data-wise.github.io/himalaya-mcp/reference/cheat-sheet/)
- [CLI Reference](https://data-wise.github.io/himalaya-mcp/reference/cli/)
- [Architecture](https://data-wise.github.io/himalaya-mcp/reference/architecture/)

### CLI man pages

The CLI ships with groff man pages following the [flow-cli](https://github.com/Data-Wise/flow-cli) standard:

```bash
# After brew install himalaya-mcp, man pages are auto-installed to /opt/homebrew/share/man
man himalaya-mcp
man himalaya-mcp-doctor
man himalaya-mcp-setup
man himalaya-mcp-install-ext
man himalaya-mcp-remove-ext

# Or from the source repo:
MANPATH=$(pwd)/man man himalaya-mcp
```

## Troubleshooting

If an email tool fails, ask Claude:

```
Run a health check on my email accounts.
```

This invokes the `health_check` MCP tool and surfaces a per-account status with one-line fix hints.

From a terminal, run:

```bash
himalaya-mcp doctor                    # All accounts
himalaya-mcp doctor --account <name>   # Single account
```

For the full failure-mode catalog and recovery steps, see [docs/troubleshooting.md](docs/troubleshooting.md).

## License

MIT
