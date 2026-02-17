# BRAINSTORM: `himalaya-mcp doctor` Command

**Generated:** 2026-02-17
**Context:** feature/mcpb-packaging branch
**From bugs:** PATH not in Desktop env, unresolved `${user_config.*}` template variables

## Overview

A diagnostic command that checks every layer of the himalaya-mcp stack — from the himalaya binary to Claude Desktop/Code integration — and offers one-command fixes for common problems.

## Proposed UX

```bash
himalaya-mcp doctor          # Run all checks
himalaya-mcp doctor --fix    # Auto-fix what can be fixed
himalaya-mcp doctor --json   # Machine-readable output
```

### Sample Output

```
himalaya-mcp doctor v1.2.1

  Prerequisites
  ✓ Node.js 22.14.0 (/opt/homebrew/bin/node)
  ✓ himalaya 1.1.0 (/opt/homebrew/bin/himalaya)
  ✓ himalaya config exists (~/.config/himalaya/config.toml)

  MCP Server
  ✓ dist/index.js exists (595 KB)
  ✓ Server starts and responds to initialize

  Email Connectivity
  ✓ Default account: unm
  ✓ Folder listing works (14 folders)
  ✓ Envelope listing works (25 emails in INBOX)

  Claude Desktop Extension
  ✓ Extension installed (~/Library/.../Claude Extensions/himalaya-mcp/)
  ✓ manifest.json valid (v0.3)
  ✓ Registry entry exists (extensions-installations.json)
  ✓ Settings file exists (isEnabled: true)
  ✗ user_config.himalaya_binary is empty
    → Fix: Set to /opt/homebrew/bin/himalaya? [Y/n]
  ✓ PATH includes /opt/homebrew/bin

  Claude Code Plugin
  ✓ Symlink exists (~/.claude/plugins/himalaya-mcp → ...)
  ✓ plugin.json valid
  ✓ Marketplace registered
  ✓ Plugin enabled in settings.json

  Environment
  ✓ HIMALAYA_BINARY not set (using default: himalaya)
  ✓ HIMALAYA_ACCOUNT not set (using default account)
  ✓ No unresolved template variables detected

  Summary: 16 passed, 1 warning, 0 failed
```

## Check Categories

### 1. Prerequisites

| Check | What | Fix |
|-------|------|-----|
| Node.js version | `node --version` >= 22 | Link to nodejs.org |
| himalaya binary | `which himalaya` or configured path | `brew install himalaya` |
| himalaya config | `~/.config/himalaya/config.toml` exists | Link to himalaya docs |

### 2. MCP Server

| Check | What | Fix |
|-------|------|-----|
| Bundle exists | `dist/index.js` present and non-empty | `npm run build:bundle` |
| Server starts | Send `initialize` JSON-RPC, get response | Show error log |
| Tools registered | Response includes 19 tools | Rebuild |
| Prompts registered | Response includes 4 prompts | Rebuild |

### 3. Email Connectivity

| Check | What | Fix |
|-------|------|-----|
| List accounts | `himalaya account list --output json` | Check config.toml |
| Default account | Identify which account is default | Show account list |
| List folders | `himalaya folder list --output json` | Check IMAP connection |
| List envelopes | `himalaya envelope list --page-size 1 --output json` | Check permissions |

### 4. Claude Desktop Extension

| Check | What | Fix (--fix) |
|-------|------|-----|
| Extension dir exists | `~/Library/.../Claude Extensions/himalaya-mcp/` | `install-ext` |
| manifest.json valid | Parse and check required fields | Reinstall |
| Registry entry | `extensions-installations.json` has himalaya-mcp | Add entry |
| Settings file | `himalaya-mcp.json` exists with isEnabled | Create default |
| user_config.himalaya_binary | Non-empty if himalaya not in default PATH | Set to `which himalaya` |
| PATH in manifest env | `/opt/homebrew/bin` included | Update manifest |
| No unresolved templates | Env vars don't contain `${` | Update config.ts guard |
| Claude Desktop running | `pgrep -x Claude` | Inform to restart |

### 5. Claude Code Plugin

| Check | What | Fix (--fix) |
|-------|------|-----|
| Symlink exists | `~/.claude/plugins/himalaya-mcp` → target | Create symlink |
| Symlink target valid | Target directory exists and has dist/ | Rebuild |
| plugin.json valid | Parse and check fields | N/A |
| Marketplace registered | Entry in `~/.claude/local-marketplace/marketplace.json` | Add entry |
| Plugin enabled | Entry in `~/.claude/settings.json` | Enable |

### 6. Environment

| Check | What | Fix |
|-------|------|-----|
| HIMALAYA_BINARY | Check for unresolved template var | Clear env var |
| HIMALAYA_ACCOUNT | Check for unresolved template var | Clear env var |
| HIMALAYA_FOLDER | Check for unresolved template var | Clear env var |
| HIMALAYA_TIMEOUT | Valid number if set | Clear env var |

## Architecture

### Where it lives

Add to existing `src/cli/setup.ts` alongside `setup`, `install-ext`, `remove-ext`:

```
himalaya-mcp setup           # Legacy Desktop config
himalaya-mcp setup --check   # Verify legacy config
himalaya-mcp setup --remove  # Remove legacy config
himalaya-mcp install-ext     # Install .mcpb extension
himalaya-mcp remove-ext      # Remove extension
himalaya-mcp doctor          # NEW: Full diagnostic
himalaya-mcp doctor --fix    # NEW: Auto-fix issues
himalaya-mcp doctor --json   # NEW: JSON output
```

### Implementation Approach

```typescript
interface CheckResult {
  name: string;
  category: string;
  status: "pass" | "warn" | "fail";
  message: string;
  fix?: {
    description: string;
    command?: string;        // Auto-fix command
    manual?: string;         // Manual fix instruction
  };
}

async function doctor(options: { fix?: boolean; json?: boolean }): Promise<void> {
  const results: CheckResult[] = [];

  // Run all checks
  results.push(...checkPrerequisites());
  results.push(...checkMcpServer());
  results.push(...await checkEmailConnectivity());
  results.push(...checkDesktopExtension());
  results.push(...checkCodePlugin());
  results.push(...checkEnvironment());

  // Apply fixes if --fix
  if (options.fix) {
    for (const r of results.filter(r => r.status !== "pass" && r.fix?.command)) {
      applyFix(r);
    }
  }

  // Output
  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    printReport(results);
  }
}
```

### Auto-fixable Issues

| Issue | Auto-fix Action |
|-------|----------------|
| himalaya_binary empty in Desktop settings | Set to `which himalaya` result |
| Extension not installed | Run `install-ext` |
| Symlink missing | Create symlink |
| Marketplace not registered | Add entry |
| Plugin not enabled | Add to settings.json |
| Settings file missing | Create default |

### Not auto-fixable (manual only)

| Issue | Why | Guidance |
|-------|-----|----------|
| Node.js not installed | System-level | `brew install node` |
| himalaya not installed | System-level | `brew install himalaya` |
| himalaya config missing | User credentials | Link to himalaya docs |
| IMAP connection failed | Auth/network | Check config.toml |
| Claude Desktop not installed | System-level | Link to download |

## Quick Wins

1. **Start with prerequisites + email connectivity** — highest value, catches the most common issues
2. **Desktop extension checks** — directly addresses today's bugs
3. **`--fix` flag** — makes it actionable, not just diagnostic
4. **JSON output** — enables CI integration and scripting

## Recommended Implementation Order

1. Core `doctor` function with check runner + reporter
2. Prerequisites checks (node, himalaya, config)
3. Email connectivity checks (accounts, folders, envelopes)
4. Desktop extension checks (install, registry, settings, templates)
5. Code plugin checks (symlink, marketplace, settings)
6. `--fix` flag with auto-fixable issues
7. `--json` output mode

## Estimated Scope

- ~200 lines of new code in `src/cli/setup.ts` (or a new `src/cli/doctor.ts`)
- ~30 lines of new tests
- No new dependencies (uses existing client, fs, child_process)
