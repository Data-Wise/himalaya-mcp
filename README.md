# himalaya-mcp

Privacy-first email MCP server and Claude Code plugin wrapping the [himalaya](https://github.com/pimalaya/himalaya) CLI.

## Features

- **11 MCP tools**: list, search, read, flag, move, draft reply, send (with safety gate), export, action items, clipboard
- **4 MCP prompts**: triage inbox, summarize email, daily digest, draft reply
- **3 MCP resources**: inbox, message by ID, folders
- **5 plugin skills**: `/email:inbox`, `/email:triage`, `/email:digest`, `/email:reply`, `/email:help`
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

### Claude Code Plugin (from GitHub)

```bash
claude plugin marketplace add Data-Wise/himalaya-mcp
claude plugin install himalaya-mcp
```

### Claude Desktop

```bash
himalaya-mcp setup
```

### Development (from source)

```bash
npm install
npm run build
ln -s ~/projects/dev-tools/himalaya-mcp ~/.claude/plugins/himalaya-mcp
```

## Prerequisites

- [himalaya CLI](https://github.com/pimalaya/himalaya) configured with at least one email account in `~/.config/himalaya/config.toml`
- Node.js 22+ (installed automatically by Homebrew)

## Testing

```bash
npm test              # 181 tests across 11 test files (vitest)
```

| Category | Tests | Coverage |
|----------|-------|----------|
| Unit (parser, config, clipboard) | 34 | Core parsing and config |
| Integration (tools, prompts) | 47 | All 11 tools + 4 prompts |
| Dogfooding | 68 | Realistic Claude usage patterns |
| E2E | 22 | Full MCP server pipeline with fake himalaya binary |
| Setup CLI | 18 | Setup command + plugin validation |

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
