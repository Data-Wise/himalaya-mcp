#!/usr/bin/env node
/**
 * himalaya-mcp setup CLI
 *
 * Manages MCP server configuration for Claude Desktop.
 *
 * Usage:
 *   himalaya-mcp setup              # Add MCP server to Claude Desktop config
 *   himalaya-mcp setup --check      # Verify configuration
 *   himalaya-mcp setup --remove     # Remove MCP server entry
 *   himalaya-mcp install-ext [file] # Install .mcpb as Claude Desktop extension
 *   himalaya-mcp remove-ext         # Remove extension from Claude Desktop
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, realpathSync, readdirSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

function getConfigDir(): string {
  switch (process.platform) {
    case "darwin":
      return join(homedir(), "Library", "Application Support", "Claude");
    case "win32": {
      const appData = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
      return join(appData, "Claude");
    }
    default:
      return join(homedir(), ".config", "Claude");
  }
}

/**
 * Find dist/index.js — the MCP server entry point.
 *
 * Resolution order:
 *   1. Relative to this script (works for Homebrew, source, and symlinked installs)
 *   2. Claude Code plugin path (~/.claude/plugins/himalaya-mcp/dist/index.js)
 */
function findServerEntry(): string {
  // This script is at dist/cli/setup.js — index.js is at dist/index.js
  const thisFile = fileURLToPath(import.meta.url);
  const distDir = dirname(dirname(realpathSync(thisFile)));
  const relativeEntry = join(distDir, "index.js");
  if (existsSync(relativeEntry)) {
    return relativeEntry;
  }

  // Fallback: Claude Code plugin symlink
  const pluginEntry = join(homedir(), ".claude", "plugins", "himalaya-mcp", "dist", "index.js");
  if (existsSync(pluginEntry)) {
    return pluginEntry;
  }

  // Last resort: return the relative path (setup --check will warn if missing)
  return relativeEntry;
}

const CONFIG_DIR = getConfigDir();
const CONFIG_PATH = join(CONFIG_DIR, "claude_desktop_config.json");

const SERVER_KEY = "himalaya";
const SERVER_CONFIG = {
  command: "node",
  args: [findServerEntry()],
};

interface DesktopConfig {
  mcpServers?: Record<string, { command: string; args: string[] }>;
  [key: string]: unknown;
}

function readConfig(): DesktopConfig {
  if (!existsSync(CONFIG_PATH)) {
    return {};
  }
  const raw = readFileSync(CONFIG_PATH, "utf-8");
  try {
    return JSON.parse(raw) as DesktopConfig;
  } catch {
    console.error(`Error: Failed to parse config at ${CONFIG_PATH}`);
    console.error("  The file contains invalid JSON. Please fix it manually.");
    process.exit(1);
  }
}

function writeConfig(config: DesktopConfig): void {
  try {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf-8");
  } catch {
    console.error(`Error: Failed to write config to ${CONFIG_PATH}`);
    console.error("  Check file permissions and try again.");
    process.exit(1);
  }
}

function setup(): void {
  const config = readConfig();
  config.mcpServers = config.mcpServers ?? {};
  config.mcpServers[SERVER_KEY] = SERVER_CONFIG;
  writeConfig(config);
  console.log("Added himalaya MCP server to Claude Desktop config.");
  console.log(`  Config: ${CONFIG_PATH}`);
  console.log("  Restart Claude Desktop to activate.");
}

function check(): void {
  if (!existsSync(CONFIG_PATH)) {
    console.log("Claude Desktop config not found.");
    console.log(`  Expected: ${CONFIG_PATH}`);
    console.log("  Run: himalaya-mcp setup");
    process.exit(1);
  }

  const config = readConfig();
  const server = config.mcpServers?.[SERVER_KEY];

  if (!server) {
    console.log("himalaya MCP server not configured.");
    console.log("  Run: himalaya-mcp setup");
    process.exit(1);
  }

  console.log("himalaya MCP server is configured.");
  console.log(`  Command: ${server.command}`);
  console.log(`  Args: ${server.args.join(" ")}`);

  // Verify the entry point exists
  const entryPoint = server.args[0];
  if (entryPoint && !existsSync(entryPoint)) {
    console.log(`  Warning: ${entryPoint} not found`);
    process.exit(1);
  }

  console.log("  Status: OK");
}

function remove(): void {
  if (!existsSync(CONFIG_PATH)) {
    console.log("Claude Desktop config not found. Nothing to remove.");
    return;
  }

  const config = readConfig();
  if (!config.mcpServers?.[SERVER_KEY]) {
    console.log("himalaya MCP server not in config. Nothing to remove.");
    return;
  }

  delete config.mcpServers[SERVER_KEY];
  writeConfig(config);
  console.log("Removed himalaya MCP server from Claude Desktop config.");
  console.log("  Restart Claude Desktop to apply.");
}

// --- Extension (.mcpb) installation ---

const EXTENSION_ID = "himalaya-mcp";
const EXTENSIONS_DIR = join(CONFIG_DIR, "Claude Extensions");
const EXTENSIONS_SETTINGS_DIR = join(CONFIG_DIR, "Claude Extensions Settings");
const INSTALLATIONS_PATH = join(CONFIG_DIR, "extensions-installations.json");

interface ExtensionManifest {
  name: string;
  version: string;
  [key: string]: unknown;
}

interface ExtensionEntry {
  id: string;
  version: string;
  hash: string;
  installedAt: string;
  manifest: ExtensionManifest;
  signatureInfo: { status: string };
  source: string;
}

interface ExtensionsRegistry {
  extensions: Record<string, ExtensionEntry>;
}

function readExtensionsRegistry(): ExtensionsRegistry {
  if (!existsSync(INSTALLATIONS_PATH)) {
    return { extensions: {} };
  }
  const raw = readFileSync(INSTALLATIONS_PATH, "utf-8");
  try {
    return JSON.parse(raw) as ExtensionsRegistry;
  } catch {
    console.error(`Error: Failed to parse ${INSTALLATIONS_PATH}`);
    process.exit(1);
  }
}

function writeExtensionsRegistry(registry: ExtensionsRegistry): void {
  writeFileSync(INSTALLATIONS_PATH, JSON.stringify(registry) + "\n", "utf-8");
}

function findMcpbFile(explicitPath?: string): string {
  if (explicitPath) {
    const resolved = resolve(explicitPath);
    if (!existsSync(resolved)) {
      console.error(`Error: File not found: ${resolved}`);
      process.exit(1);
    }
    return resolved;
  }

  // Look for .mcpb in project root (relative to this script)
  const thisFile = fileURLToPath(import.meta.url);
  const projectRoot = dirname(dirname(dirname(realpathSync(thisFile))));

  const files = readdirSync(projectRoot).filter(
    (f: string) => f.startsWith("himalaya-mcp-v") && f.endsWith(".mcpb")
  );

  if (files.length === 0) {
    console.error("Error: No .mcpb file found. Run: npm run build:mcpb");
    process.exit(1);
  }

  files.sort();
  return join(projectRoot, files[files.length - 1]);
}

function installExtension(mcpbPath?: string): void {
  const file = findMcpbFile(mcpbPath);
  console.log(`Installing extension from: ${file}`);

  const extDir = join(EXTENSIONS_DIR, EXTENSION_ID);

  // Unpack using mcpb CLI (execFileSync avoids shell injection)
  mkdirSync(EXTENSIONS_DIR, { recursive: true });
  if (existsSync(extDir)) {
    rmSync(extDir, { recursive: true });
  }

  try {
    execFileSync("npx", ["--yes", "@anthropic-ai/mcpb", "unpack", file, extDir], {
      stdio: "pipe",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error: Failed to unpack .mcpb: ${message}`);
    process.exit(1);
  }

  // Read the unpacked manifest
  const manifestPath = join(extDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    console.error("Error: Unpacked extension missing manifest.json");
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as ExtensionManifest;

  // Calculate hash of the .mcpb file
  const fileBuffer = readFileSync(file);
  const hash = createHash("sha256").update(fileBuffer).digest("hex");

  // Register in extensions-installations.json
  const registry = readExtensionsRegistry();
  registry.extensions[EXTENSION_ID] = {
    id: EXTENSION_ID,
    version: manifest.version,
    hash,
    installedAt: new Date().toISOString(),
    manifest,
    signatureInfo: { status: "unsigned" },
    source: "local",
  };
  writeExtensionsRegistry(registry);

  // Create default settings file (enabled with empty user config)
  const settingsPath = join(EXTENSIONS_SETTINGS_DIR, `${EXTENSION_ID}.json`);
  mkdirSync(EXTENSIONS_SETTINGS_DIR, { recursive: true });
  if (!existsSync(settingsPath)) {
    writeFileSync(
      settingsPath,
      JSON.stringify({ isEnabled: true, userConfig: {} }, null, 2) + "\n",
      "utf-8"
    );
  }

  console.log(`Installed himalaya-mcp v${manifest.version} as Claude Desktop extension.`);
  console.log(`  Extension dir: ${extDir}`);
  console.log(`  Settings: ${settingsPath}`);
  console.log("  Restart Claude Desktop to activate.");
}

function removeExtension(): void {
  const extDir = join(EXTENSIONS_DIR, EXTENSION_ID);
  const settingsPath = join(EXTENSIONS_SETTINGS_DIR, `${EXTENSION_ID}.json`);

  let removed = false;

  if (existsSync(extDir)) {
    rmSync(extDir, { recursive: true });
    console.log(`Removed extension directory: ${extDir}`);
    removed = true;
  }

  const registry = readExtensionsRegistry();
  if (registry.extensions[EXTENSION_ID]) {
    delete registry.extensions[EXTENSION_ID];
    writeExtensionsRegistry(registry);
    console.log("Removed from extensions registry.");
    removed = true;
  }

  if (existsSync(settingsPath)) {
    rmSync(settingsPath);
    console.log("Removed extension settings.");
    removed = true;
  }

  if (!removed) {
    console.log("himalaya-mcp extension not installed. Nothing to remove.");
    return;
  }

  console.log("  Restart Claude Desktop to apply.");
}

// --- Doctor command ---

interface CheckResult {
  name: string;
  category: string;
  status: "pass" | "warn" | "fail";
  message: string;
  fix?: {
    description: string;
    auto?: () => void;
  };
}

function execQuiet(bin: string, args: string[]): { ok: boolean; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(bin, args, { timeout: 10_000, stdio: "pipe" }).toString().trim();
    return { ok: true, stdout, stderr: "" };
  } catch (err: unknown) {
    const stderr = err instanceof Error ? err.message : String(err);
    return { ok: false, stdout: "", stderr };
  }
}

function whichBin(name: string): string | null {
  const { ok, stdout } = execQuiet("which", [name]);
  return ok && stdout ? stdout.split("\n")[0] : null;
}

function checkPrerequisites(): CheckResult[] {
  const results: CheckResult[] = [];

  // Node.js
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1), 10);
  if (major >= 22) {
    results.push({ name: "Node.js", category: "Prerequisites", status: "pass", message: `${nodeVersion} (${process.execPath})` });
  } else {
    results.push({ name: "Node.js", category: "Prerequisites", status: "fail", message: `${nodeVersion} — requires 22+. brew install node` });
  }

  // himalaya binary
  const himalayaPath = whichBin("himalaya");
  if (himalayaPath) {
    const ver = execQuiet(himalayaPath, ["--version"]);
    const versionStr = ver.ok ? ver.stdout.split("\n")[0] : "unknown";
    results.push({ name: "himalaya CLI", category: "Prerequisites", status: "pass", message: `${versionStr} (${himalayaPath})` });
  } else {
    results.push({
      name: "himalaya CLI", category: "Prerequisites", status: "fail",
      message: "Not found in PATH. Install: brew install himalaya",
    });
  }

  // himalaya config
  const configPath = join(homedir(), ".config", "himalaya", "config.toml");
  if (existsSync(configPath)) {
    results.push({ name: "himalaya config", category: "Prerequisites", status: "pass", message: configPath });
  } else {
    results.push({
      name: "himalaya config", category: "Prerequisites", status: "warn",
      message: `Not found at ${configPath}. See: https://github.com/pimalaya/himalaya`,
    });
  }

  return results;
}

function checkMcpServer(): CheckResult[] {
  const results: CheckResult[] = [];

  const entryPoint = findServerEntry();
  if (existsSync(entryPoint)) {
    const size = readFileSync(entryPoint).length;
    results.push({ name: "dist/index.js", category: "MCP Server", status: "pass", message: `exists (${Math.round(size / 1024)} KB)` });
  } else {
    results.push({
      name: "dist/index.js", category: "MCP Server", status: "fail",
      message: `Not found at ${entryPoint}. Run: npm run build:bundle`,
    });
  }

  return results;
}

function checkEmailConnectivity(): CheckResult[] {
  const results: CheckResult[] = [];

  const himalayaPath = whichBin("himalaya");
  if (!himalayaPath) {
    results.push({ name: "Email connectivity", category: "Email", status: "fail", message: "Skipped — himalaya not installed" });
    return results;
  }

  // List accounts
  const accounts = execQuiet(himalayaPath, ["account", "list", "--output", "json"]);
  if (accounts.ok) {
    try {
      const parsed = JSON.parse(accounts.stdout) as Array<{ name: string; backend: string; default: boolean }>;
      const defaultAcct = parsed.find(a => a.default);
      const acctName = defaultAcct ? defaultAcct.name : parsed[0]?.name || "unknown";
      results.push({ name: "Default account", category: "Email", status: "pass", message: acctName });
    } catch {
      results.push({ name: "Default account", category: "Email", status: "warn", message: "Could not parse account list" });
    }
  } else {
    results.push({ name: "Default account", category: "Email", status: "fail", message: "Failed to list accounts. Check himalaya config." });
    return results;
  }

  // List folders
  const folders = execQuiet(himalayaPath, ["folder", "list", "--output", "json"]);
  if (folders.ok) {
    try {
      const parsed = JSON.parse(folders.stdout) as unknown[];
      results.push({ name: "Folder listing", category: "Email", status: "pass", message: `works (${parsed.length} folders)` });
    } catch {
      results.push({ name: "Folder listing", category: "Email", status: "warn", message: "Could not parse folder list" });
    }
  } else {
    results.push({ name: "Folder listing", category: "Email", status: "fail", message: "Failed. Check IMAP connection." });
  }

  // List envelopes (just 1 to test connectivity)
  const envelopes = execQuiet(himalayaPath, ["envelope", "list", "--page-size", "1", "--output", "json"]);
  if (envelopes.ok) {
    results.push({ name: "Envelope listing", category: "Email", status: "pass", message: "works" });
  } else {
    results.push({ name: "Envelope listing", category: "Email", status: "fail", message: "Failed to list emails" });
  }

  return results;
}

function checkDesktopExtension(): CheckResult[] {
  const results: CheckResult[] = [];

  const extDir = join(EXTENSIONS_DIR, EXTENSION_ID);
  const manifestPath = join(extDir, "manifest.json");
  const settingsPath = join(EXTENSIONS_SETTINGS_DIR, `${EXTENSION_ID}.json`);

  // Extension directory
  if (existsSync(extDir) && existsSync(manifestPath)) {
    results.push({ name: "Extension installed", category: "Desktop Extension", status: "pass", message: extDir });
  } else {
    results.push({
      name: "Extension installed", category: "Desktop Extension", status: "fail",
      message: "Not installed. Run: himalaya-mcp install-ext",
    });
    return results;
  }

  // Manifest validation
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as Record<string, unknown>;
    const version = manifest.manifest_version || manifest.dxt_version || "unknown";
    results.push({ name: "manifest.json", category: "Desktop Extension", status: "pass", message: `valid (v${version})` });
  } catch {
    results.push({ name: "manifest.json", category: "Desktop Extension", status: "fail", message: "Invalid JSON" });
  }

  // Registry entry
  const registry = readExtensionsRegistry();
  if (registry.extensions[EXTENSION_ID]) {
    results.push({ name: "Registry entry", category: "Desktop Extension", status: "pass", message: "exists in extensions-installations.json" });
  } else {
    results.push({ name: "Registry entry", category: "Desktop Extension", status: "warn", message: "Not in registry. May need reinstall." });
  }

  // Settings file
  if (existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(readFileSync(settingsPath, "utf-8")) as { isEnabled?: boolean; userConfig?: Record<string, string> };
      const enabled = settings.isEnabled !== false;
      results.push({ name: "Settings file", category: "Desktop Extension", status: "pass", message: `exists (isEnabled: ${enabled})` });

      // Check user_config.himalaya_binary
      const binary = settings.userConfig?.himalaya_binary;
      const himalayaPath = whichBin("himalaya");
      if (binary && existsSync(binary)) {
        results.push({ name: "user_config.himalaya_binary", category: "Desktop Extension", status: "pass", message: binary });
      } else if (!binary && himalayaPath) {
        results.push({
          name: "user_config.himalaya_binary", category: "Desktop Extension", status: "warn",
          message: `Empty (himalaya found at ${himalayaPath})`,
          fix: {
            description: `Set to ${himalayaPath}`,
            auto: () => {
              settings.userConfig = settings.userConfig || {};
              settings.userConfig.himalaya_binary = himalayaPath;
              writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");
            },
          },
        });
      } else if (!binary) {
        results.push({ name: "user_config.himalaya_binary", category: "Desktop Extension", status: "fail", message: "Empty and himalaya not in PATH" });
      } else {
        results.push({ name: "user_config.himalaya_binary", category: "Desktop Extension", status: "fail", message: `File not found: ${binary}` });
      }
    } catch {
      results.push({ name: "Settings file", category: "Desktop Extension", status: "fail", message: "Invalid JSON" });
    }
  } else {
    results.push({
      name: "Settings file", category: "Desktop Extension", status: "warn",
      message: "Missing. Will be created with defaults.",
      fix: {
        description: "Create default settings",
        auto: () => {
          mkdirSync(EXTENSIONS_SETTINGS_DIR, { recursive: true });
          writeFileSync(settingsPath, JSON.stringify({ isEnabled: true, userConfig: {} }, null, 2) + "\n", "utf-8");
        },
      },
    });
  }

  return results;
}

function checkCodePlugin(): CheckResult[] {
  const results: CheckResult[] = [];

  const symlinkPath = join(homedir(), ".claude", "plugins", "himalaya-mcp");

  // Symlink
  if (existsSync(symlinkPath)) {
    let target = symlinkPath;
    try { target = realpathSync(symlinkPath); } catch { /* keep original */ }
    results.push({ name: "Plugin symlink", category: "Claude Code Plugin", status: "pass", message: `${symlinkPath} → ${target}` });

    // plugin.json
    const pluginJson = join(symlinkPath, ".claude-plugin", "plugin.json");
    if (existsSync(pluginJson)) {
      results.push({ name: "plugin.json", category: "Claude Code Plugin", status: "pass", message: "valid" });
    } else {
      results.push({ name: "plugin.json", category: "Claude Code Plugin", status: "fail", message: "Missing .claude-plugin/plugin.json" });
    }
  } else {
    results.push({
      name: "Plugin symlink", category: "Claude Code Plugin", status: "warn",
      message: `Not found at ${symlinkPath}. Plugin not installed for Claude Code.`,
    });
    return results;
  }

  // Marketplace registration
  const marketplacePath = join(homedir(), ".claude", "local-marketplace", "marketplace.json");
  if (existsSync(marketplacePath)) {
    try {
      const raw = readFileSync(marketplacePath, "utf-8");
      if (raw.includes("himalaya-mcp") || raw.includes("email")) {
        results.push({ name: "Marketplace registered", category: "Claude Code Plugin", status: "pass", message: "found in local-marketplace" });
      } else {
        results.push({ name: "Marketplace registered", category: "Claude Code Plugin", status: "warn", message: "Not found in marketplace.json" });
      }
    } catch {
      results.push({ name: "Marketplace registered", category: "Claude Code Plugin", status: "warn", message: "Could not read marketplace.json" });
    }
  } else {
    results.push({ name: "Marketplace registered", category: "Claude Code Plugin", status: "warn", message: "local-marketplace not found" });
  }

  return results;
}

function checkEnvironment(): CheckResult[] {
  const results: CheckResult[] = [];
  const vars = ["HIMALAYA_BINARY", "HIMALAYA_ACCOUNT", "HIMALAYA_FOLDER", "HIMALAYA_TIMEOUT"];

  for (const key of vars) {
    const val = process.env[key];
    if (!val) {
      // Not set — fine, using defaults
      continue;
    }
    if (val.startsWith("${")) {
      results.push({
        name: key, category: "Environment", status: "fail",
        message: `Unresolved template variable: ${val}`,
      });
    } else {
      results.push({ name: key, category: "Environment", status: "pass", message: val });
    }
  }

  if (results.length === 0) {
    results.push({ name: "HIMALAYA_* env vars", category: "Environment", status: "pass", message: "None set (using defaults)" });
  }

  return results;
}

function doctor(flags: { fix: boolean; json: boolean }): void {
  const results: CheckResult[] = [
    ...checkPrerequisites(),
    ...checkMcpServer(),
    ...checkEmailConnectivity(),
    ...checkDesktopExtension(),
    ...checkCodePlugin(),
    ...checkEnvironment(),
  ];

  // Apply auto-fixes
  if (flags.fix) {
    for (const r of results) {
      if (r.status !== "pass" && r.fix?.auto) {
        try {
          r.fix.auto();
          r.status = "pass";
          r.message += " (fixed)";
        } catch (err: unknown) {
          r.message += ` (fix failed: ${err instanceof Error ? err.message : String(err)})`;
        }
      }
    }
  }

  // Output
  if (flags.json) {
    const output = results.map(r => ({
      name: r.name,
      category: r.category,
      status: r.status,
      message: r.message,
      fixAvailable: !!r.fix,
    }));
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // Pretty-print
  const version = getVersion();
  console.log(`himalaya-mcp doctor${version ? ` v${version}` : ""}\n`);

  let currentCategory = "";
  const icons = { pass: "\u2713", warn: "!", fail: "\u2717" };
  let pass = 0, warn = 0, fail = 0;

  for (const r of results) {
    if (r.category !== currentCategory) {
      currentCategory = r.category;
      console.log(`  ${currentCategory}`);
    }

    const icon = icons[r.status];
    console.log(`  ${icon} ${r.name}: ${r.message}`);
    if (r.status !== "pass" && r.fix && !flags.fix) {
      console.log(`    Fix: ${r.fix.description} (run with --fix)`);
    }

    if (r.status === "pass") pass++;
    else if (r.status === "warn") warn++;
    else fail++;
  }

  console.log("");
  console.log(`  Summary: ${pass} passed, ${warn} warnings, ${fail} failed`);

  if (fail > 0) process.exit(1);
}

function getVersion(): string {
  try {
    const thisFile = fileURLToPath(import.meta.url);
    const projectRoot = dirname(dirname(dirname(realpathSync(thisFile))));
    const pkg = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf-8")) as { version?: string };
    return pkg.version || "";
  } catch {
    return "";
  }
}

// CLI argument parsing
const args = process.argv.slice(2);
const command = args[0];

if (command === "--check" || command === "check") {
  check();
} else if (command === "--remove" || command === "remove") {
  remove();
} else if (command === "install-ext") {
  installExtension(args[1]);
} else if (command === "remove-ext") {
  removeExtension();
} else if (command === "doctor") {
  const fix = args.includes("--fix");
  const json = args.includes("--json");
  doctor({ fix, json });
} else if (!command || command === "setup") {
  setup();
} else {
  console.log("himalaya-mcp CLI");
  console.log("");
  console.log("Usage:");
  console.log("  himalaya-mcp setup              Add MCP server to Claude Desktop config");
  console.log("  himalaya-mcp setup --check      Verify configuration");
  console.log("  himalaya-mcp setup --remove     Remove MCP server entry");
  console.log("  himalaya-mcp install-ext [file]  Install .mcpb as Desktop extension");
  console.log("  himalaya-mcp remove-ext          Remove Desktop extension");
  console.log("  himalaya-mcp doctor              Diagnose installation and connectivity");
  console.log("  himalaya-mcp doctor --fix        Auto-fix common issues");
  console.log("  himalaya-mcp doctor --json       Machine-readable output");
}
