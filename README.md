# himalaya-mcp

Privacy-first email MCP server and Claude Code plugin wrapping the [himalaya](https://github.com/pimalaya/himalaya) CLI.

## Features

- **11 MCP tools**: list, search, read, flag, move, draft reply, send (with safety gate), export, action items, clipboard
- **4 MCP prompts**: triage inbox, summarize email, daily digest, draft reply
- **3 MCP resources**: inbox, message by ID, folders
- **Multi-account**: per-call account switching via `--account`
- **Safe subprocess**: uses `execFile` (no shell injection)
- **Two-phase send**: `send_email` returns preview first, requires explicit `confirm=true`
- **Claude Code plugin**: install as a plugin or standalone MCP server
- **Env-based config**: `HIMALAYA_BINARY`, `HIMALAYA_ACCOUNT`, `HIMALAYA_FOLDER`, `HIMALAYA_TIMEOUT`

## Quick Start

```bash
npm install
npm run build
```

### As Claude Code Plugin

```bash
ln -s ~/projects/dev-tools/himalaya-mcp ~/.claude/plugins/himalaya-mcp
```

### As Standalone MCP Server

```json
{
  "mcpServers": {
    "himalaya": {
      "command": "node",
      "args": ["/path/to/himalaya-mcp/dist/index.js"]
    }
  }
}
```

## Prerequisites

- Node.js 22+
- [himalaya CLI](https://github.com/pimalaya/himalaya) (`brew install himalaya`)
- Configured email account in `~/.config/himalaya/config.toml`

## Testing

```bash
npm test              # 122 tests across 10 test files (vitest)
```

Tests include unit tests, dogfooding tests (realistic Claude usage patterns), and headless E2E tests (full MCP server pipeline with fake himalaya binary).

## Documentation

- **[User Guide](docs/guide.md)** -- setup, configuration, all tools/prompts/resources
- **[Quick Reference](docs/REFCARD.md)** -- one-page cheat sheet
- **[Workflows](docs/workflows.md)** -- common email patterns (triage, reply, digest, export)
- **[Architecture](docs/architecture.md)** -- system design, module map, data flow

## License

MIT
