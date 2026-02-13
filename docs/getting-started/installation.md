# Installation

## Prerequisites

| Requirement | Version | Install |
|-------------|---------|---------|
| Node.js | 22+ | [nodejs.org](https://nodejs.org/) |
| himalaya CLI | latest | `brew install himalaya` |
| Email account | -- | Configured in `~/.config/himalaya/config.toml` |

### Verify himalaya works

```bash
himalaya --output json envelope list
```

This should print JSON envelopes from your default account. If it fails, check the [himalaya docs](https://github.com/pimalaya/himalaya) for account setup.

## Install himalaya-mcp

```bash
git clone https://github.com/Data-Wise/himalaya-mcp.git
cd himalaya-mcp
npm install
npm run build
```

## Setup Options

### Option 1: Claude Code Plugin (recommended)

Symlink the project into your plugins directory:

```bash
ln -s ~/projects/dev-tools/himalaya-mcp ~/.claude/plugins/himalaya-mcp
```

Restart Claude Code. You'll get:

- `/email:inbox` -- list recent emails
- `/email:triage` -- classify and organize
- `/email:digest` -- daily priority digest
- `/email:reply` -- draft with safety gate

### Option 2: Standalone MCP Server

Add to your Claude Code settings (`~/.claude/settings.json`):

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

Or for Claude Desktop, add to `claude_desktop_config.json`.

## Configuration

All optional. Set via environment variables in your MCP server config:

| Variable | Default | Description |
|----------|---------|-------------|
| `HIMALAYA_BINARY` | `himalaya` | Path to himalaya binary |
| `HIMALAYA_ACCOUNT` | (system default) | Default email account name |
| `HIMALAYA_FOLDER` | `INBOX` | Default folder for operations |
| `HIMALAYA_TIMEOUT` | `30000` | Command timeout in milliseconds |

### Example with env vars

```json
{
  "mcpServers": {
    "himalaya": {
      "command": "node",
      "args": ["/path/to/himalaya-mcp/dist/index.js"],
      "env": {
        "HIMALAYA_ACCOUNT": "work",
        "HIMALAYA_TIMEOUT": "60000"
      }
    }
  }
}
```

## Verify Installation

```bash
# Run the MCP server directly
node dist/index.js

# Run tests (122 tests)
npm test
```
