# himalaya-mcp

Privacy-first email MCP server and Claude Code plugin wrapping the [himalaya](https://github.com/pimalaya/himalaya) CLI.

## Features

- **4 MCP tools**: list, search, read (plain text + HTML)
- **3 MCP resources**: inbox, message by ID, folders
- **Multi-account**: per-call account switching via `--account`
- **Safe subprocess**: uses `execFile` (no shell injection)
- **Claude Code plugin**: install as a plugin or standalone MCP server

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
npm test              # 39 unit/integration tests (vitest)
npm run test:e2e      # E2E against live himalaya CLI
```

## License

MIT
