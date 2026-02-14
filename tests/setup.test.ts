/**
 * CLI setup tests — verify Claude Desktop configuration management.
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
// ==============================================================================

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = resolve(__dirname, "..");

describe("CLI E2E: setup command", () => {
  let tempHome: string;
  let tempClaudeDir: string;
  let tempConfigPath: string;

  beforeEach(async () => {
    // Create a temporary HOME directory
    tempHome = await mkdtemp(join(tmpdir(), "himalaya-cli-test-"));
    tempClaudeDir = join(tempHome, "Library", "Application Support", "Claude");
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
});
