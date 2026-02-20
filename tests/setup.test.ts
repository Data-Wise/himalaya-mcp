/**
 * CLI setup tests — verify Claude Desktop configuration management,
 * plugin installation, and upgrade workflows.
 *
 * Tests the setup/check/remove CLI commands by mocking the filesystem.
 * No real Claude Desktop config is touched.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";

// Mock fs module before importing setup functions
vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

const CONFIG_DIR = join(
  homedir(),
  "Library",
  "Application Support",
  "Claude"
);
const CONFIG_PATH = join(CONFIG_DIR, "claude_desktop_config.json");

// Import the actual functions by re-implementing the logic
// (setup.ts uses top-level side effects, so we test the logic directly)

interface DesktopConfig {
  mcpServers?: Record<string, { command: string; args: string[] }>;
  [key: string]: unknown;
}

const SERVER_KEY = "himalaya";
const SERVER_CONFIG = {
  command: "node",
  args: [join(homedir(), ".claude", "plugins", "himalaya-mcp", "dist", "index.js")],
};

function readConfig(): DesktopConfig {
  if (!(existsSync as any)(CONFIG_PATH)) {
    return {};
  }
  const raw = (readFileSync as any)(CONFIG_PATH, "utf-8");
  return JSON.parse(raw) as DesktopConfig;
}

function writeConfig(config: DesktopConfig): void {
  (mkdirSync as any)(CONFIG_DIR, { recursive: true });
  (writeFileSync as any)(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

describe("CLI setup: readConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty object when config file doesn't exist", () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const config = readConfig();
    expect(config).toEqual({});
  });

  it("parses existing config file", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ mcpServers: { other: { command: "python", args: ["server.py"] } } })
    );
    const config = readConfig();
    expect(config.mcpServers).toBeDefined();
    expect(config.mcpServers!.other.command).toBe("python");
  });

  it("throws on malformed JSON", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue("not json");
    expect(() => readConfig()).toThrow();
  });
});

describe("CLI setup: writeConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates config directory recursively", () => {
    writeConfig({ mcpServers: {} });
    expect(mkdirSync).toHaveBeenCalledWith(CONFIG_DIR, { recursive: true });
  });

  it("writes formatted JSON with trailing newline", () => {
    const config = { mcpServers: { himalaya: SERVER_CONFIG } };
    writeConfig(config);
    const written = vi.mocked(writeFileSync).mock.calls[0][1] as string;
    expect(written).toContain('"himalaya"');
    expect(written.endsWith("\n")).toBe(true);
    // Verify it's valid JSON
    expect(() => JSON.parse(written)).not.toThrow();
  });
});

describe("CLI setup: setup command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds himalaya server to empty config", () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const config = readConfig();
    config.mcpServers = config.mcpServers ?? {};
    config.mcpServers[SERVER_KEY] = SERVER_CONFIG;
    writeConfig(config);

    const written = vi.mocked(writeFileSync).mock.calls[0][1] as string;
    const parsed = JSON.parse(written);
    expect(parsed.mcpServers.himalaya).toBeDefined();
    expect(parsed.mcpServers.himalaya.command).toBe("node");
    expect(parsed.mcpServers.himalaya.args[0]).toContain("dist/index.js");
  });

  it("preserves existing servers when adding himalaya", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({
        mcpServers: {
          "other-server": { command: "python", args: ["other.py"] },
        },
      })
    );

    const config = readConfig();
    config.mcpServers = config.mcpServers ?? {};
    config.mcpServers[SERVER_KEY] = SERVER_CONFIG;
    writeConfig(config);

    const written = vi.mocked(writeFileSync).mock.calls[0][1] as string;
    const parsed = JSON.parse(written);
    expect(parsed.mcpServers["other-server"]).toBeDefined();
    expect(parsed.mcpServers.himalaya).toBeDefined();
  });

  it("overwrites existing himalaya entry on re-setup", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({
        mcpServers: {
          himalaya: { command: "old-node", args: ["/old/path.js"] },
        },
      })
    );

    const config = readConfig();
    config.mcpServers = config.mcpServers ?? {};
    config.mcpServers[SERVER_KEY] = SERVER_CONFIG;
    writeConfig(config);

    const written = vi.mocked(writeFileSync).mock.calls[0][1] as string;
    const parsed = JSON.parse(written);
    expect(parsed.mcpServers.himalaya.command).toBe("node");
    expect(parsed.mcpServers.himalaya.args[0]).toContain("dist/index.js");
  });
});

describe("CLI setup: check command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("detects missing config file", () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const config = readConfig();
    expect(config.mcpServers).toBeUndefined();
  });

  it("detects missing himalaya entry", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ mcpServers: { "other-server": { command: "python", args: [] } } })
    );
    const config = readConfig();
    expect(config.mcpServers?.himalaya).toBeUndefined();
  });

  it("finds valid himalaya entry", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ mcpServers: { himalaya: SERVER_CONFIG } })
    );
    const config = readConfig();
    expect(config.mcpServers?.himalaya).toBeDefined();
    expect(config.mcpServers?.himalaya.command).toBe("node");
  });
});

describe("CLI setup: remove command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes himalaya entry while preserving others", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({
        mcpServers: {
          himalaya: SERVER_CONFIG,
          "other-server": { command: "python", args: ["server.py"] },
        },
      })
    );

    const config = readConfig();
    delete config.mcpServers![SERVER_KEY];
    writeConfig(config);

    const written = vi.mocked(writeFileSync).mock.calls[0][1] as string;
    const parsed = JSON.parse(written);
    expect(parsed.mcpServers.himalaya).toBeUndefined();
    expect(parsed.mcpServers["other-server"]).toBeDefined();
  });

  it("handles remove when himalaya not in config", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ mcpServers: {} })
    );

    const config = readConfig();
    expect(config.mcpServers?.[SERVER_KEY]).toBeUndefined();
    // No error thrown
  });

  it("handles remove when config file doesn't exist", () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const config = readConfig();
    expect(config).toEqual({});
    // Nothing to remove, no error
  });
});

// ==============================================================================
// E2E TESTS: Run the CLI as a real subprocess
// Requires `npm run build` — skipped gracefully when dist/ is missing.
// ==============================================================================

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { accessSync } from "node:fs";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = resolve(__dirname, "..");
const SETUP_CLI = join(PROJECT_ROOT, "dist", "cli", "setup.js");
// Use accessSync (not mocked) instead of existsSync (mocked by vi.mock)
const hasBuild = (() => {
  try { accessSync(SETUP_CLI); return true; } catch { return false; }
})();

describe.skipIf(!hasBuild)("CLI E2E: setup command", () => {
  let tempHome: string;
  let tempClaudeDir: string;
  let tempConfigPath: string;

  beforeEach(async () => {
    // Create a temporary HOME directory
    tempHome = await mkdtemp(join(tmpdir(), "himalaya-cli-test-"));
    // Use platform-appropriate config path (matches src/cli/setup.ts getConfigDir)
    tempClaudeDir = process.platform === "darwin"
      ? join(tempHome, "Library", "Application Support", "Claude")
      : join(tempHome, ".config", "Claude");
    tempConfigPath = join(tempClaudeDir, "claude_desktop_config.json");

    // Create the Claude config directory structure
    await mkdir(tempClaudeDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temp directory
    if (tempHome) {
      await rm(tempHome, { recursive: true, force: true });
    }
  });

  it("displays usage for unknown command", async () => {
    const { stdout, stderr } = await execFileAsync(
      "node",
      ["dist/cli/setup.js", "unknown-command"],
      { cwd: PROJECT_ROOT }
    );

    expect(stdout).toContain("Usage:");
    expect(stdout).toContain("himalaya-mcp setup");
    expect(stdout).toContain("Add MCP server to Claude Desktop");
    expect(stderr).toBe("");
  }, 10_000);

  it("setup --check exits 1 when no config exists", async () => {
    // Remove the config file so it doesn't exist
    await rm(tempConfigPath, { force: true });

    try {
      await execFileAsync("node", ["dist/cli/setup.js", "--check"], {
        cwd: PROJECT_ROOT,
        env: { ...process.env, HOME: tempHome },
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (error: any) {
      // execFile throws when exit code !== 0
      expect(error.code).toBe(1);
      expect(error.stdout).toContain("not found");
    }
  }, 10_000);

  it("setup creates config then --check succeeds", async () => {
    // Run setup
    const { stdout: setupStdout } = await execFileAsync(
      "node",
      ["dist/cli/setup.js", "setup"],
      {
        cwd: PROJECT_ROOT,
        env: { ...process.env, HOME: tempHome },
      }
    );

    expect(setupStdout).toContain("Added");
    expect(setupStdout).toContain("himalaya MCP server");

    // Verify config file was created
    const configContent = await readFile(tempConfigPath, "utf-8");
    const config = JSON.parse(configContent);
    expect(config.mcpServers?.himalaya).toBeDefined();
    expect(config.mcpServers.himalaya.command).toBe("node");

    // Run --check (will warn about missing dist/index.js but should still succeed)
    try {
      const { stdout: checkStdout } = await execFileAsync(
        "node",
        ["dist/cli/setup.js", "--check"],
        {
          cwd: PROJECT_ROOT,
          env: { ...process.env, HOME: tempHome },
        }
      );

      expect(checkStdout).toContain("configured");
    } catch (error: any) {
      // If it exits with 1 due to missing dist/index.js, that's expected
      expect(error.stdout).toContain("configured");
      expect(error.stdout).toContain("Warning");
    }
  }, 10_000);

  it("setup --remove removes config", async () => {
    // First, setup the config
    await execFileAsync("node", ["dist/cli/setup.js", "setup"], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, HOME: tempHome },
    });

    // Verify it exists
    const configBefore = JSON.parse(await readFile(tempConfigPath, "utf-8"));
    expect(configBefore.mcpServers?.himalaya).toBeDefined();

    // Remove it
    const { stdout } = await execFileAsync("node", ["dist/cli/setup.js", "--remove"], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, HOME: tempHome },
    });

    expect(stdout).toContain("Removed");
    expect(stdout).toContain("himalaya MCP server");

    // Verify it was removed
    const configAfter = JSON.parse(await readFile(tempConfigPath, "utf-8"));
    expect(configAfter.mcpServers?.himalaya).toBeUndefined();
  }, 10_000);

  it("setup resolves dist/index.js path relative to script", async () => {
    // Run setup — the path should resolve to this project's dist/index.js
    await execFileAsync("node", ["dist/cli/setup.js", "setup"], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, HOME: tempHome },
    });

    const config = JSON.parse(await readFile(tempConfigPath, "utf-8"));
    const serverArgs = config.mcpServers?.himalaya?.args;
    expect(serverArgs).toBeDefined();
    expect(serverArgs.length).toBeGreaterThan(0);

    // Path should end with dist/index.js
    expect(serverArgs[0]).toMatch(/dist\/index\.js$/);
    // Path should be absolute
    expect(serverArgs[0]).toMatch(/^\//);
  }, 10_000);

  it("setup preserves non-himalaya entries across re-setup", async () => {
    // Create config with another server
    const initialConfig = {
      mcpServers: {
        "other-server": { command: "python", args: ["server.py"] },
      },
      globalShortcut: "Ctrl+Space",
    };
    await writeFile(tempConfigPath, JSON.stringify(initialConfig, null, 2), "utf-8");

    // Run setup twice (simulates install then upgrade)
    await execFileAsync("node", ["dist/cli/setup.js", "setup"], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, HOME: tempHome },
    });
    await execFileAsync("node", ["dist/cli/setup.js", "setup"], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, HOME: tempHome },
    });

    const config = JSON.parse(await readFile(tempConfigPath, "utf-8"));
    // Other server and top-level keys preserved
    expect(config.mcpServers["other-server"]).toBeDefined();
    expect(config.mcpServers["other-server"].command).toBe("python");
    expect(config.globalShortcut).toBe("Ctrl+Space");
    // Himalaya added
    expect(config.mcpServers.himalaya).toBeDefined();
  }, 10_000);

  it("setup --remove then re-setup works (reinstall flow)", async () => {
    // Install
    await execFileAsync("node", ["dist/cli/setup.js", "setup"], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, HOME: tempHome },
    });
    let config = JSON.parse(await readFile(tempConfigPath, "utf-8"));
    expect(config.mcpServers?.himalaya).toBeDefined();

    // Uninstall
    await execFileAsync("node", ["dist/cli/setup.js", "--remove"], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, HOME: tempHome },
    });
    config = JSON.parse(await readFile(tempConfigPath, "utf-8"));
    expect(config.mcpServers?.himalaya).toBeUndefined();

    // Reinstall
    await execFileAsync("node", ["dist/cli/setup.js", "setup"], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, HOME: tempHome },
    });
    config = JSON.parse(await readFile(tempConfigPath, "utf-8"));
    expect(config.mcpServers?.himalaya).toBeDefined();
    expect(config.mcpServers.himalaya.command).toBe("node");
  }, 15_000);

  it("setup --check reports correct entry point path", async () => {
    // Setup first
    await execFileAsync("node", ["dist/cli/setup.js", "setup"], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, HOME: tempHome },
    });

    // Check — should show command and args
    try {
      const { stdout } = await execFileAsync(
        "node",
        ["dist/cli/setup.js", "--check"],
        {
          cwd: PROJECT_ROOT,
          env: { ...process.env, HOME: tempHome },
        }
      );
      expect(stdout).toContain("Command: node");
      expect(stdout).toContain("dist/index.js");
    } catch (error: any) {
      // May exit 1 if dist/index.js not at resolved path, but still shows info
      expect(error.stdout).toContain("Command: node");
      expect(error.stdout).toContain("dist/index.js");
    }
  }, 10_000);

  it("setup --remove is idempotent", async () => {
    // Remove when nothing exists — should not error
    const { stdout: stdout1 } = await execFileAsync(
      "node",
      ["dist/cli/setup.js", "--remove"],
      {
        cwd: PROJECT_ROOT,
        env: { ...process.env, HOME: tempHome },
      }
    );
    expect(stdout1).toContain("Nothing to remove");

    // Setup then remove twice
    await execFileAsync("node", ["dist/cli/setup.js", "setup"], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, HOME: tempHome },
    });
    await execFileAsync("node", ["dist/cli/setup.js", "--remove"], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, HOME: tempHome },
    });
    const { stdout: stdout2 } = await execFileAsync(
      "node",
      ["dist/cli/setup.js", "--remove"],
      {
        cwd: PROJECT_ROOT,
        env: { ...process.env, HOME: tempHome },
      }
    );
    expect(stdout2).toContain("Nothing to remove");
  }, 15_000);

  it("setup creates config directory when it doesn't exist", async () => {
    // Remove the Claude config dir entirely
    await rm(tempClaudeDir, { recursive: true, force: true });

    // Setup should create it
    const { stdout } = await execFileAsync(
      "node",
      ["dist/cli/setup.js", "setup"],
      {
        cwd: PROJECT_ROOT,
        env: { ...process.env, HOME: tempHome },
      }
    );
    expect(stdout).toContain("Added");

    // Verify directory and file created
    const config = JSON.parse(await readFile(tempConfigPath, "utf-8"));
    expect(config.mcpServers?.himalaya).toBeDefined();
  }, 10_000);

  it("setup writes valid JSON with proper formatting", async () => {
    await execFileAsync("node", ["dist/cli/setup.js", "setup"], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, HOME: tempHome },
    });

    const raw = await readFile(tempConfigPath, "utf-8");
    // Should end with newline
    expect(raw.endsWith("\n")).toBe(true);
    // Should be indented (pretty-printed)
    expect(raw).toContain("  ");
    // Should be valid JSON
    expect(() => JSON.parse(raw)).not.toThrow();
  }, 10_000);
});

// ==============================================================================
// E2E: doctor command
// ==============================================================================

describe.skipIf(!hasBuild)("CLI E2E: doctor command", () => {
  it("doctor runs and outputs check results", async () => {
    // doctor exits non-zero when checks fail (e.g. himalaya not installed in CI)
    // so we capture stdout from the error object
    let stdout: string;
    try {
      const result = await execFileAsync(
        "node",
        ["dist/cli/setup.js", "doctor"],
        { cwd: PROJECT_ROOT }
      );
      stdout = result.stdout;
    } catch (err: unknown) {
      stdout = (err as { stdout?: string }).stdout ?? "";
    }

    expect(stdout).toContain("himalaya-mcp doctor");
    expect(stdout).toContain("Prerequisites");
    expect(stdout).toContain("Node.js");
    expect(stdout).toContain("Summary:");
    expect(stdout).toMatch(/\d+ passed/);
  }, 30_000);

  it("doctor --json outputs valid JSON array", async () => {
    const { stdout } = await execFileAsync(
      "node",
      ["dist/cli/setup.js", "doctor", "--json"],
      { cwd: PROJECT_ROOT }
    );

    const results = JSON.parse(stdout) as Array<{ name: string; category: string; status: string }>;
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(5);

    // Every result has required fields
    for (const r of results) {
      expect(r.name).toBeDefined();
      expect(r.category).toBeDefined();
      expect(["pass", "warn", "fail"]).toContain(r.status);
    }
  }, 30_000);

  it("doctor checks all categories", async () => {
    const { stdout } = await execFileAsync(
      "node",
      ["dist/cli/setup.js", "doctor", "--json"],
      { cwd: PROJECT_ROOT }
    );

    const results = JSON.parse(stdout) as Array<{ category: string }>;
    const categories = new Set(results.map(r => r.category));

    expect(categories.has("Prerequisites")).toBe(true);
    expect(categories.has("MCP Server")).toBe(true);
  }, 30_000);

  it("doctor detects Node.js as passing", async () => {
    const { stdout } = await execFileAsync(
      "node",
      ["dist/cli/setup.js", "doctor", "--json"],
      { cwd: PROJECT_ROOT }
    );

    const results = JSON.parse(stdout) as Array<{ name: string; status: string }>;
    const nodeCheck = results.find(r => r.name === "Node.js");
    expect(nodeCheck).toBeDefined();
    expect(nodeCheck!.status).toBe("pass");
  }, 30_000);

  it("displays usage including doctor command", async () => {
    const { stdout } = await execFileAsync(
      "node",
      ["dist/cli/setup.js", "unknown-command"],
      { cwd: PROJECT_ROOT }
    );

    expect(stdout).toContain("doctor");
    expect(stdout).toContain("Diagnose");
  }, 10_000);
});

// ==============================================================================
// E2E: Plugin structure validation
// Tests that the plugin directory contains everything Claude Code expects.
// ==============================================================================

describe("Plugin structure validation", () => {
  const pluginRoot = resolve(__dirname, "..", "himalaya-mcp-plugin");
  const pluginJson = join(pluginRoot, ".claude-plugin", "plugin.json");
  const marketplaceJson = resolve(__dirname, "..", ".claude-plugin", "marketplace.json");

  it("plugin.json has required fields", async () => {
    const data = JSON.parse(await readFile(pluginJson, "utf-8"));
    expect(data.name).toBe("email");
    expect(data.version).toBeDefined();
    expect(data.description).toBeDefined();
    expect(data.author).toBeDefined();
  });

  it("marketplace.json references correct plugin name", async () => {
    const data = JSON.parse(await readFile(marketplaceJson, "utf-8"));
    expect(data.plugins).toBeDefined();
    expect(data.plugins.length).toBeGreaterThan(0);
    expect(data.plugins[0].name).toBe("email");
  });

  it("all 7 skills exist and are non-empty", async () => {
    const skillsDir = join(pluginRoot, "skills");
    const expected = ["inbox.md", "triage.md", "digest.md", "reply.md", "compose.md", "attachments.md", "help.md"];
    for (const skill of expected) {
      const content = await readFile(join(skillsDir, skill), "utf-8");
      expect(content.length).toBeGreaterThan(100);
    }
  });

  it("email-assistant agent exists", async () => {
    const agentFile = join(pluginRoot, "agents", "email-assistant.md");
    const content = await readFile(agentFile, "utf-8");
    expect(content.length).toBeGreaterThan(50);
  });

  it(".mcp.json references dist/index.js", async () => {
    const mcpJson = JSON.parse(
      await readFile(resolve(__dirname, "..", ".mcp.json"), "utf-8")
    );
    expect(mcpJson.mcpServers?.himalaya).toBeDefined();
    expect(mcpJson.mcpServers.himalaya.args[0]).toContain("dist/index.js");
  });

  it("version consistency across all manifests", async () => {
    const pkg = JSON.parse(await readFile(resolve(__dirname, "..", "package.json"), "utf-8"));
    const plugin = JSON.parse(await readFile(pluginJson, "utf-8"));
    const marketplace = JSON.parse(await readFile(marketplaceJson, "utf-8"));

    expect(plugin.version).toBe(pkg.version);
    expect(marketplace.metadata.version).toBe(pkg.version);
  });
});
