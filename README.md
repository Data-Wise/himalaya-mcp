# himalaya-mcp

Privacy-first email for Claude -- MCP server and Claude Code plugin (`email`) wrapping the [himalaya](https://github.com/pimalaya/himalaya) CLI.

## Features

- **19 MCP tools**: list, search, read, flag, move, compose, draft reply, send (with safety gate), export, action items, clipboard, folders, attachments, calendar
- **4 MCP prompts**: triage inbox, summarize email, daily digest, draft reply
- **3 MCP resources**: inbox, message by ID, folders
- **7 plugin skills**: `/email:inbox`, `/email:triage`, `/email:digest`, `/email:reply`, `/email:compose`, `/email:attachments`, `/email:help`
- **Multi-account**: per-call account switching via `--account`
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
claude plugin install email
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
npm test              # 315 tests across 15 test files (vitest)
```

| Category | Tests | Coverage |
|----------|-------|----------|
| Unit (parser, config, clipboard) | 35 | Core parsing, config, template variable guards |
| Integration (tools, prompts) | 80 | All 19 tools + 4 prompts |
| Dogfooding | 122 | Realistic Claude usage + .mcpb packaging validation |
| E2E | 34 | Full MCP server pipeline + .mcpb build pipeline |
| Setup CLI | 36 | Setup, install/upgrade E2E, doctor command, plugin structure |

## Documentation

Full documentation at **[data-wise.github.io/himalaya-mcp](https://data-wise.github.io/himalaya-mcp/)**

- [Installation](https://data-wise.github.io/himalaya-mcp/getting-started/installation/)
- [Quick Start](https://data-wise.github.io/himalaya-mcp/getting-started/quickstart/)
- [Tutorials](https://data-wise.github.io/himalaya-mcp/tutorials/)
- [User Guide](https://data-wise.github.io/himalaya-mcp/guide/guide/)
- [Command Reference](https://data-wise.github.io/himalaya-mcp/reference/commands/)
- [Quick Reference Card](https://data-wise.github.io/himalaya-mcp/reference/refcard/)
- [Architecture](https://data-wise.github.io/himalaya-mcp/reference/architecture/)

## License

MIT
