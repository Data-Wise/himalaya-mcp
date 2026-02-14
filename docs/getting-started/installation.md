# Installation

## Prerequisites

| Requirement | Version | Install |
|-------------|---------|---------|
| Node.js | 22+ | [nodejs.org](https://nodejs.org/) or `brew install node` |
| himalaya CLI | latest | `brew install himalaya` |
| Email account | -- | Configured in `~/.config/himalaya/config.toml` |

### Verify himalaya works

```bash
himalaya --output json envelope list
```

This should print JSON envelopes from your default account. If it fails, check the [himalaya docs](https://github.com/pimalaya/himalaya) for account setup.

## Install Methods

### Option 1: Homebrew (recommended)

Zero-config install. Homebrew handles dependencies, bundling, plugin registration, and auto-enabling.

```bash
brew tap data-wise/tap
brew install himalaya-mcp
```

**What happens automatically:**

1. Installs himalaya CLI + Node.js as dependencies
2. Builds the esbuild bundle (583KB, no node_modules shipped)
3. Symlinks plugin to `~/.claude/plugins/himalaya-mcp`
4. Registers in local marketplace
5. Auto-enables in Claude Code settings (if Claude not running)

After install, restart Claude Code. You'll get:

- `/email:inbox` -- list recent emails
- `/email:triage` -- classify and organize
- `/email:digest` -- daily priority digest
- `/email:reply` -- draft with safety gate

**Upgrade:**

```bash
brew upgrade himalaya-mcp
```

**Uninstall** (cleans up symlinks and marketplace entry):

```bash
brew uninstall himalaya-mcp
```

### Option 2: GitHub Plugin Install

```bash
claude plugin add github:Data-Wise/himalaya-mcp
```

### Option 3: From Source (development)

```bash
git clone https://github.com/Data-Wise/himalaya-mcp.git
cd himalaya-mcp
npm install
npm run build
ln -s $(pwd) ~/.claude/plugins/himalaya-mcp
```

### Option 4: Standalone MCP Server

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

## Claude Desktop Setup

After installing himalaya-mcp, configure it as an MCP server for Claude Desktop:

```bash
himalaya-mcp setup           # Add to Claude Desktop config
himalaya-mcp setup --check   # Verify configuration
himalaya-mcp setup --remove  # Remove server entry
```

This adds the server to `~/Library/Application Support/Claude/claude_desktop_config.json`. Restart Claude Desktop after running setup.

**Manual configuration** (if you prefer):

```json
{
  "mcpServers": {
    "himalaya": {
      "command": "node",
      "args": ["~/.claude/plugins/himalaya-mcp/dist/index.js"]
    }
  }
}
```

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

# Run tests (154 tests)
npm test

# Check Claude Desktop config
himalaya-mcp setup --check
```

## Troubleshooting

### Homebrew install fails on symlink

If macOS permissions prevent automatic symlinking:

```bash
ln -sf $(brew --prefix)/opt/himalaya-mcp/libexec ~/.claude/plugins/himalaya-mcp
```

### Plugin not loading after install

1. Restart Claude Code
2. Check if plugin is enabled: `claude plugin list`
3. Manually enable: `claude plugin install himalaya-mcp@local-plugins`

### MCP server not starting

Verify the bundled server works:

```bash
echo '{}' | node ~/.claude/plugins/himalaya-mcp/dist/index.js
```

If you see a JSON-RPC response, the server is working. Check your MCP configuration paths.
