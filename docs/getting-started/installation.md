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

After install, run `himalaya-mcp-install` and restart Claude Code. The **`email`** plugin gives you:

- `/email:inbox` -- list recent emails
- `/email:triage` -- classify and organize
- `/email:digest` -- daily priority digest
- `/email:reply` -- draft with safety gate
- `/email:compose` -- compose new emails
- `/email:attachments` -- list, download, calendar invites
- `/email:help` -- help hub

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
claude plugin marketplace add Data-Wise/himalaya-mcp
claude plugin install email
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

### Option A: .mcpb Package (one-click)

Download `himalaya-mcp-v{version}.mcpb` from [GitHub Releases](https://github.com/Data-Wise/himalaya-mcp/releases) and double-click to install in Claude Desktop. The `.mcpb` is a lightweight (~147 KB) package that bundles the MCP server and configures it automatically.

**Prerequisite:** himalaya CLI must be installed separately:

```bash
brew install himalaya
```

During install, you can configure:

- **himalaya binary path** -- path to himalaya binary (default: `himalaya`)
- **Default account** -- email account name (default: system default)
- **Default folder** -- folder for operations (default: `INBOX`)

### Option A2: .mcpb via CLI

If you have himalaya-mcp installed (Homebrew or source), you can install the extension from the command line:

```bash
npm run build:mcpb                                     # Build .mcpb (dev only)
himalaya-mcp install-ext himalaya-mcp-v1.2.1.mcpb      # Install from file
himalaya-mcp install-ext                                # Auto-find in project root
himalaya-mcp remove-ext                                 # Uninstall extension
```

This unpacks the extension to Claude Desktop's extensions directory and registers it. Restart Claude Desktop after install.

### Option B: CLI Setup (Legacy)

After installing himalaya-mcp via Homebrew or from source, configure it as an MCP server for Claude Desktop:

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
| `HIMALAYA_TIMEOUT` | `0` (no limit) | Command timeout in milliseconds (0 = unlimited) |

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
# Full diagnostic (checks prereqs, MCP server, email, Desktop extension, plugin)
himalaya-mcp doctor

# Auto-fix common issues
himalaya-mcp doctor --fix

# Run tests (314 tests)
npm test

# Check Claude Desktop config (legacy)
himalaya-mcp setup --check
```

## Troubleshooting

### Homebrew install hangs during post-install

If `brew install` or `brew upgrade` takes a very long time, Claude Code may be holding file locks. Kill the stuck process and complete manually:

```bash
# If brew hangs, press Ctrl+C then:
claude plugin install email@local-plugins
```

This is fixed in the latest formula -- JSON file writes are skipped when Claude is running.

### Homebrew install fails on symlink

If macOS permissions prevent automatic symlinking:

```bash
ln -sf $(brew --prefix)/opt/himalaya-mcp/libexec ~/.claude/plugins/himalaya-mcp
```

### Plugin not loading after install

1. Restart Claude Code
2. Check if plugin is enabled: `claude plugin list`
3. Manually enable: `claude plugin install email@local-plugins`

### MCP server not starting

Verify the bundled server works:

```bash
echo '{}' | node ~/.claude/plugins/himalaya-mcp/dist/index.js
```

If you see a JSON-RPC response, the server is working. Check your MCP configuration paths.

### Desktop Extension not working

Run the doctor command to diagnose:

```bash
himalaya-mcp doctor
```

Common issues it catches:
- himalaya binary not found (PATH not inherited by Desktop)
- Unresolved `${user_config.*}` template variables
- Missing extension registry or settings files

Use `--fix` to auto-resolve what it can, or see the [Troubleshooting Guide](../guide/troubleshooting.md) for manual fixes.

## What's Next?

Ready to use himalaya-mcp? Start with the [Tutorials](../tutorials/index.md) -- read your first email in 2 minutes, then work up to full inbox automation.
