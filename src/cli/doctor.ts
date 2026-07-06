/**
 * himalaya-mcp doctor — diagnose installation and per-account connectivity.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";
import {
  CONFIG_DIR,
  CONFIG_PATH,
  EXTENSION_ID,
  EXTENSIONS_DIR,
  EXTENSIONS_SETTINGS_DIR,
  INSTALLATIONS_PATH,
  findServerEntry,
  getVersion,
} from "./shared.js";
import { listAccounts, type Account } from "../himalaya/accounts.js";

export interface CheckResult {
  name: string;
  category: string;
  status: "pass" | "warn" | "fail";
  message: string;
  fix?: {
    description: string;
    auto?: () => void;
  };
}

export interface AccountHealth {
  reachable: boolean;
  error?: string;
  hint?: string;
}

export interface DoctorOptions {
  account?: string;
  fix?: boolean;
  json?: boolean;
  includeBaseChecks?: boolean;
  probeAccount?: (name: string) => Promise<AccountHealth> | AccountHealth;
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

  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1), 10);
  if (major >= 22) {
    results.push({ name: "Node.js", category: "Prerequisites", status: "pass", message: `${nodeVersion} (${process.execPath})` });
  } else {
    results.push({ name: "Node.js", category: "Prerequisites", status: "fail", message: `${nodeVersion} — requires 22+. brew install node` });
  }

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

  if (existsSync(extDir) && existsSync(manifestPath)) {
    results.push({ name: "Extension installed", category: "Desktop Extension", status: "pass", message: extDir });
  } else {
    results.push({
      name: "Extension installed", category: "Desktop Extension", status: "fail",
      message: "Not installed. Run: himalaya-mcp install-ext",
    });
    return results;
  }

  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as Record<string, unknown>;
    const version = manifest.manifest_version || manifest.dxt_version || "unknown";
    results.push({ name: "manifest.json", category: "Desktop Extension", status: "pass", message: `valid (v${version})` });
  } catch {
    results.push({ name: "manifest.json", category: "Desktop Extension", status: "fail", message: "Invalid JSON" });
  }

  const registry = readRegistry();
  if (registry.extensions[EXTENSION_ID]) {
    results.push({ name: "Registry entry", category: "Desktop Extension", status: "pass", message: "exists in extensions-installations.json" });
  } else {
    results.push({ name: "Registry entry", category: "Desktop Extension", status: "warn", message: "Not in registry. May need reinstall." });
  }

  if (existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(readFileSync(settingsPath, "utf-8")) as { isEnabled?: boolean; userConfig?: Record<string, string> };
      const enabled = settings.isEnabled !== false;
      results.push({ name: "Settings file", category: "Desktop Extension", status: "pass", message: `exists (isEnabled: ${enabled})` });

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

  if (existsSync(symlinkPath)) {
    let target = symlinkPath;
    try { target = realpathSync(symlinkPath); } catch { /* keep original */ }
    results.push({ name: "Plugin symlink", category: "Claude Code Plugin", status: "pass", message: `${symlinkPath} → ${target}` });

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

  const marketplacePath = join(homedir(), ".claude", "local-marketplace", ".claude-plugin", "marketplace.json");
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

function checkPluginCache(): CheckResult[] {
  const results: CheckResult[] = [];

  const cachePaths = [
    join(homedir(), ".claude", "plugins", "cache", "himalaya-mcp"),
    join(homedir(), ".claude", "plugins", "cache", "local-plugins", "himalaya-mcp"),
  ];

  for (const cachePath of cachePaths) {
    if (existsSync(cachePath)) {
      results.push({
        name: "Plugin cache", category: "Claude Code Plugin", status: "warn",
        message: `Stale cache found at ${cachePath}`,
        fix: {
          description: `Remove stale cache at ${cachePath}`,
          auto: () => {
            rmSync(cachePath, { recursive: true });
          },
        },
      });
    }
  }

  if (results.length === 0) {
    results.push({ name: "Plugin cache", category: "Claude Code Plugin", status: "pass", message: "No stale cache found" });
  }

  return results;
}

function checkEnvironment(): CheckResult[] {
  const results: CheckResult[] = [];
  const vars = ["HIMALAYA_BINARY", "HIMALAYA_ACCOUNT", "HIMALAYA_FOLDER", "HIMALAYA_TIMEOUT"];

  for (const key of vars) {
    const val = process.env[key];
    if (!val) continue;
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

function readRegistry(): { extensions: Record<string, unknown> } {
  if (!existsSync(INSTALLATIONS_PATH)) return { extensions: {} };
  try {
    return JSON.parse(readFileSync(INSTALLATIONS_PATH, "utf-8")) as { extensions: Record<string, unknown> };
  } catch {
    return { extensions: {} };
  }
}

export function checkAccountHealth(name: string): AccountHealth {
  const himalayaPath = whichBin("himalaya");
  if (!himalayaPath) {
    return {
      reachable: false,
      error: "himalaya CLI not found on PATH",
      hint: "Install: brew install himalaya",
    };
  }
  let stdout = "";
  let stderr = "";
  let ok = false;
  try {
    stdout = execFileSync(
      himalayaPath,
      ["folder", "list", "--account", name, "--output", "json"],
      { timeout: 5_000, stdio: "pipe" },
    ).toString().trim();
    ok = true;
  } catch (err: unknown) {
    stderr = err instanceof Error ? err.message : String(err);
  }
  if (ok && stdout) {
    return { reachable: true };
  }
  return { reachable: false, error: stderr || "folder list failed" };
}

export async function runDoctor(opts: DoctorOptions = {}): Promise<string> {
  const includeBase = opts.includeBaseChecks !== false;
  const results: CheckResult[] = includeBase
    ? [
        ...checkPrerequisites(),
        ...checkMcpServer(),
        ...checkEmailConnectivity(),
        ...checkDesktopExtension(),
        ...checkCodePlugin(),
        ...checkPluginCache(),
        ...checkEnvironment(),
      ]
    : [];

  if (opts.fix) {
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

  const lines: string[] = [];
  const version = getVersion();
  lines.push(`himalaya-mcp doctor${version ? ` v${version}` : ""}`);
  lines.push("");

  let currentCategory = "";
  const icons = { pass: "✓", warn: "!", fail: "✗" };
  let pass = 0, warn = 0, fail = 0;

  for (const r of results) {
    if (r.category !== currentCategory) {
      currentCategory = r.category;
      lines.push(`  ${currentCategory}`);
    }

    const icon = icons[r.status];
    lines.push(`  ${icon} ${r.name}: ${r.message}`);
    if (r.status !== "pass" && r.fix && !opts.fix) {
      lines.push(`    Fix: ${r.fix.description} (run with --fix)`);
    }

    if (r.status === "pass") pass++;
    else if (r.status === "warn") warn++;
    else fail++;
  }

  lines.push("");
  lines.push("  Accounts");
  let accountsToCheck: Account[] = [];
  if (opts.account) {
    accountsToCheck = [{ name: opts.account, isDefault: false }];
  } else {
    try {
      accountsToCheck = await listAccounts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      lines.push(`  ${icons.fail} Could not list accounts: ${msg}`);
      accountsToCheck = [];
      fail++;
    }
  }

  const probe = opts.probeAccount ?? checkAccountHealth;
  let anyAccountFailed = false;
  for (const acc of accountsToCheck) {
    const status = await probe(acc.name);
    if (status.reachable) {
      lines.push(`  ${icons.pass} ${acc.name}: reachable`);
      pass++;
    } else {
      anyAccountFailed = true;
      lines.push(`  ${icons.fail} ${acc.name}: ${status.error}`);
      if (status.hint) lines.push(`    Hint: ${status.hint}`);
      fail++;
    }
  }

  lines.push("");
  lines.push(`  Summary: ${pass} passed, ${warn} warnings, ${fail} failed`);

  if (anyAccountFailed || fail > 0) {
    lines.push("");
    lines.push("  See: docs/troubleshooting.md");
  }

  return lines.join("\n");
}

async function runDoctorJson(opts: DoctorOptions): Promise<{ output: string; failed: number }> {
  const results: CheckResult[] = [
    ...checkPrerequisites(),
    ...checkMcpServer(),
    ...checkEmailConnectivity(),
    ...checkDesktopExtension(),
    ...checkCodePlugin(),
    ...checkPluginCache(),
    ...checkEnvironment(),
  ];

  if (opts.fix) {
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

  let accountsToCheck: Account[] = [];
  if (opts.account) {
    accountsToCheck = [{ name: opts.account, isDefault: false }];
  } else {
    try {
      accountsToCheck = await listAccounts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({
        name: "list",
        category: "Accounts",
        status: "fail",
        message: `Could not list accounts: ${msg}`,
      });
    }
  }
  const probe = opts.probeAccount ?? checkAccountHealth;
  for (const acc of accountsToCheck) {
    const status = await probe(acc.name);
    results.push({
      name: acc.name,
      category: "Accounts",
      status: status.reachable ? "pass" : "fail",
      message: status.reachable ? "reachable" : (status.error ?? "unreachable"),
    });
  }

  const failed = results.filter(r => r.status === "fail").length;
  const output = JSON.stringify(
    results.map(r => ({
      name: r.name,
      category: r.category,
      status: r.status,
      message: r.message,
      fixAvailable: !!r.fix,
    })),
    null,
    2,
  );
  return { output, failed };
}

/** Thin CLI wrapper around runDoctor / runDoctorJson. */
export async function doctor(flags: { fix: boolean; json: boolean; account?: string }): Promise<void> {
  if (flags.json) {
    const { output, failed } = await runDoctorJson(flags);
    console.log(output);
    if (failed > 0) process.exit(1);
    return;
  }

  const output = await runDoctor(flags);
  console.log(output);
  if (output.includes("✗")) process.exit(1);
}
