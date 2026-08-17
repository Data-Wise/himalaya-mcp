/**
 * himalaya-mcp doctor — diagnose installation and per-account connectivity.
 */

import {
  existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, realpathSync, readdirSync, lstatSync, symlinkSync,
} from "node:fs";
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
import { detectHimalayaVersion } from "../himalaya/cli-version.js";
import { HimalayaClient } from "../himalaya/client.js";
import { probeAccountSurfaces } from "../himalaya/diagnostics.js";
import { HimalayaError } from "../himalaya/errors.js";

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

/**
 * Cache one HimalayaClient per himalaya binary path so the --version probe
 * (cached per client instance) runs once per invocation rather than once per
 * account. checkAccountHealth is called once per account by runDoctor.
 */
const clientCache = new Map<string, HimalayaClient>();

/** Test hook: drop cached clients so each test starts with a fresh version probe. */
export function clearDoctorClientCache(): void {
  clientCache.clear();
}

export interface DoctorOptions {
  account?: string;
  fix?: boolean;
  json?: boolean;
  preRelease?: boolean;
  postRelease?: boolean;
  includeBaseChecks?: boolean;
  probeAccount?: (name: string) => Promise<AccountHealth> | AccountHealth;
}

function execQuiet(bin: string, args: string[], timeout = 10_000): { ok: boolean; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(bin, args, { timeout, stdio: "pipe" }).toString().trim();
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

export async function checkPrerequisites(): Promise<CheckResult[]> {
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
    // Single source of truth with HimalayaClient: same detection module,
    // called fresh here (doctor is a one-shot CLI invocation in its own
    // process — nothing to share a cache with).
    try {
      const version = await detectHimalayaVersion(himalayaPath);
      const branch = version.major >= 2 ? "v2 syntax (mailbox/--json)" : "v1 syntax (folder/--output json)";
      results.push({
        name: "himalaya CLI", category: "Prerequisites", status: "pass",
        message: `${version.raw} (${himalayaPath}) — using ${branch}`,
      });
    } catch (err: unknown) {
      const detail = err instanceof HimalayaError ? err.envelope.message : String(err);
      results.push({
        name: "himalaya CLI", category: "Prerequisites", status: "fail",
        message: `Could not detect version: ${detail}`,
      });
    }
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

async function checkEmailConnectivity(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const himalayaPath = whichBin("himalaya");
  if (!himalayaPath) {
    results.push({ name: "Email connectivity", category: "Email", status: "fail", message: "Skipped — himalaya not installed" });
    return results;
  }

  // Same dual-syntax branch as HimalayaClient (see cli-version.ts) --
  // this function bypasses HimalayaClient entirely (uses execQuiet
  // directly), so it needs its own version check rather than inheriting one.
  let isV2 = true;
  try {
    isV2 = (await detectHimalayaVersion(himalayaPath)).major >= 2;
  } catch {
    // Version detection failed -- the "himalaya CLI" prerequisite check
    // above already reports this; fall through assuming v2 (current
    // Homebrew stable) rather than blocking this check entirely.
  }
  const outputFlag = isV2 ? ["--json"] : ["--output", "json"];
  const mailboxSubcommand = isV2 ? "mailbox" : "folder";

  const accounts = execQuiet(himalayaPath, ["account", "list", ...outputFlag]);
  if (accounts.ok) {
    try {
      // v2 wraps the array as {accounts: [...]}; v1 returns a bare array.
      const rawParsed = JSON.parse(accounts.stdout) as
        | Array<{ name: string; backend: string; default: boolean }>
        | { accounts: Array<{ name: string; backend: string; default: boolean }> };
      const parsed = Array.isArray(rawParsed) ? rawParsed : rawParsed.accounts;
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

  const folders = execQuiet(himalayaPath, [mailboxSubcommand, "list", ...outputFlag]);
  if (folders.ok) {
    try {
      // v2 wraps the array as {mailboxes: [...]}; v1 returns a bare array.
      const rawParsed = JSON.parse(folders.stdout) as unknown[] | { mailboxes: unknown[] };
      const parsed = Array.isArray(rawParsed) ? rawParsed : rawParsed.mailboxes;
      results.push({ name: "Folder listing", category: "Email", status: "pass", message: `works (${parsed.length} folders)` });
    } catch {
      results.push({ name: "Folder listing", category: "Email", status: "warn", message: "Could not parse folder list" });
    }
  } else {
    results.push({ name: "Folder listing", category: "Email", status: "fail", message: "Failed. Check IMAP connection." });
  }

  const envelopes = execQuiet(himalayaPath, ["envelope", "list", "--page-size", "1", ...outputFlag]);
  if (envelopes.ok) {
    try {
      // v2 wraps the array as {envelopes: [...]}; v1 returns a bare array.
      const rawParsed = JSON.parse(envelopes.stdout) as unknown[] | { envelopes: unknown[] };
      const parsed = Array.isArray(rawParsed) ? rawParsed : rawParsed.envelopes;
      results.push({ name: "Envelope listing", category: "Email", status: "pass", message: `works (${parsed.length} envelopes)` });
    } catch {
      results.push({ name: "Envelope listing", category: "Email", status: "warn", message: "Could not parse envelope list" });
    }
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

function brewLibexecPath(): string | null {
  for (const prefix of ["/opt/homebrew", "/usr/local"]) {
    const libexec = join(prefix, "opt", "himalaya-mcp", "libexec");
    if (existsSync(libexec)) return libexec;
  }
  return null;
}

function readPluginVersion(jsonPath: string): string | null {
  try {
    if (!existsSync(jsonPath)) return null;
    const parsed = JSON.parse(readFileSync(jsonPath, "utf-8")) as { version?: string };
    return parsed.version ?? null;
  } catch {
    return null;
  }
}

function relinkFix(dir: string, libexec: string): CheckResult["fix"] {
  return {
    description: `Deletes ${dir} and relinks it to ${libexec} (replaces a stale directory copy with a symlink that tracks brew upgrades)`,
    auto: () => {
      rmSync(dir, { recursive: true, force: true });
      symlinkSync(libexec, dir, "dir");
    },
  };
}

export function assessVersionDrift(opts: {
  binaryVersion: string;
  pluginDir: string;
  pluginJsonPath: string;
  sourceDir: string;
  sourceJsonPath: string;
  brewLibexecPath: string | null;
}): CheckResult[] {
  const { binaryVersion, pluginDir, pluginJsonPath, sourceDir, sourceJsonPath, brewLibexecPath } = opts;
  const results: CheckResult[] = [];

  if (!binaryVersion) return results;

  const pluginVersion = readPluginVersion(pluginJsonPath);

  if (pluginVersion === null) {
    results.push({ name: "Plugin version", category: "Claude Code Plugin", status: "warn", message: "Could not read installed plugin version" });
  } else if (pluginVersion !== binaryVersion) {
    const fix = brewLibexecPath && existsSync(join(brewLibexecPath, ".claude-plugin", "plugin.json")) ? relinkFix(pluginDir, brewLibexecPath) : undefined;
    results.push({
      name: "Plugin version", category: "Claude Code Plugin", status: "warn",
      message: `Installed plugin v${pluginVersion} ≠ binary v${binaryVersion}. Run: himalaya-mcp doctor --fix (relinks the plugin dir to the Homebrew install), then: claude plugin update himalaya-mcp@local-plugins`,
      fix,
    });
  } else {
    results.push({ name: "Plugin version", category: "Claude Code Plugin", status: "pass", message: `v${pluginVersion} matches binary` });
  }

  if (!existsSync(sourceDir)) {
    // existsSync follows symlinks: false for a broken symlink. Distinguish it
    // from a genuinely-absent source dir so a dangling link is flagged, not skipped.
    let isBrokenSymlink = false;
    try { isBrokenSymlink = lstatSync(sourceDir).isSymbolicLink(); } catch { /* absent or unreadable */ }
    if (isBrokenSymlink) {
      results.push({
        name: "Marketplace source version", category: "Claude Code Plugin", status: "warn",
        message: "local-marketplace source is a broken symlink (target missing). Run: himalaya-mcp doctor --fix",
      });
    }
    return results;
  }

  let isSymlink = false;
  try { isSymlink = lstatSync(sourceDir).isSymbolicLink(); } catch { /* keep false */ }

  const sourceVersion = readPluginVersion(sourceJsonPath);

  if (sourceVersion === null) {
    results.push({ name: "Marketplace source version", category: "Claude Code Plugin", status: "warn", message: "Could not read local-marketplace source version" });
  } else if (sourceVersion !== binaryVersion || !isSymlink) {
    const parts: string[] = [];
    if (sourceVersion !== binaryVersion) parts.push(`local-marketplace source v${sourceVersion} ≠ binary v${binaryVersion}`);
    if (!isSymlink) parts.push("local-marketplace source is a copy, not a symlink — brew upgrades will not propagate");
    const fix = brewLibexecPath && existsSync(join(brewLibexecPath, ".claude-plugin", "plugin.json")) ? relinkFix(sourceDir, brewLibexecPath) : undefined;
    results.push({
      name: "Marketplace source version", category: "Claude Code Plugin", status: "warn",
      message: `${parts.join("; ")}. Run: himalaya-mcp doctor --fix (relinks the marketplace source), then: claude plugin update himalaya-mcp@local-plugins`,
      fix,
    });
  } else {
    results.push({ name: "Marketplace source version", category: "Claude Code Plugin", status: "pass", message: `symlinked to a current install, v${sourceVersion} matches binary` });
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

    const sourceDir = join(homedir(), ".claude", "local-marketplace", "himalaya-mcp");
    results.push(...assessVersionDrift({
      binaryVersion: getVersion(),
      pluginDir: symlinkPath,
      pluginJsonPath: pluginJson,
      sourceDir,
      sourceJsonPath: join(sourceDir, ".claude-plugin", "marketplace.json"),
      brewLibexecPath: brewLibexecPath(),
    }));
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

function checkPreRelease(): CheckResult[] {
  const results: CheckResult[] = [];

  const pkgPath = join(process.cwd(), "package.json");
  const pluginPath = join(process.cwd(), "himalaya-mcp-plugin", ".claude-plugin", "plugin.json");
  const changelogPath = join(process.cwd(), "CHANGELOG.md");
  const indexPath = join(process.cwd(), "src", "index.ts");

  // 1. Build exists
  const entryPoint = findServerEntry();
  if (existsSync(entryPoint)) {
    const size = readFileSync(entryPoint).length;
    results.push({ name: "Build exists", category: "Pre-Release", status: "pass", message: `dist/index.js (${Math.round(size / 1024)} KB)` });
  } else {
    results.push({ name: "Build exists", category: "Pre-Release", status: "fail", message: "dist/index.js not found. Run: npm run build:bundle" });
  }

  // 2. TypeScript compiles
  const tscResult = execQuiet("npx", ["tsc", "--noEmit"], 60_000);
  if (tscResult.ok) {
    results.push({ name: "TypeScript", category: "Pre-Release", status: "pass", message: "compiles clean" });
  } else {
    results.push({ name: "TypeScript", category: "Pre-Release", status: "fail", message: `compile errors: ${tscResult.stderr.slice(0, 120)}` });
  }

  // 3. Version consistency
  if (existsSync(pkgPath) && existsSync(pluginPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version: string };
      const plugin = JSON.parse(readFileSync(pluginPath, "utf-8")) as { version: string };
      if (pkg.version === plugin.version) {
        results.push({ name: "Version sync", category: "Pre-Release", status: "pass", message: `package.json = plugin.json = ${pkg.version}` });
      } else {
        results.push({ name: "Version sync", category: "Pre-Release", status: "fail", message: `package.json (${pkg.version}) ≠ plugin.json (${plugin.version})` });
      }
    } catch {
      results.push({ name: "Version sync", category: "Pre-Release", status: "warn", message: "Could not parse version files" });
    }
  }

  // 4. src/index.ts VERSION matches package.json
  if (existsSync(indexPath) && existsSync(pkgPath)) {
    try {
      const indexContent = readFileSync(indexPath, "utf-8");
      const versionMatch = indexContent.match(/VERSION\s*=\s*"([^"]+)"/);
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version: string };
      if (versionMatch && versionMatch[1] === pkg.version) {
        results.push({ name: "src/index.ts VERSION", category: "Pre-Release", status: "pass", message: `${versionMatch[1]} matches package.json` });
      } else {
        results.push({ name: "src/index.ts VERSION", category: "Pre-Release", status: "fail", message: `VERSION="${versionMatch?.[1]}" ≠ package.json (${pkg.version})` });
      }
    } catch {
      results.push({ name: "src/index.ts VERSION", category: "Pre-Release", status: "warn", message: "Could not verify" });
    }
  }

  // 5. CHANGELOG has entry for current version
  if (existsSync(changelogPath) && existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version: string };
      const changelog = readFileSync(changelogPath, "utf-8");
      if (changelog.includes(`[${pkg.version}]`)) {
        results.push({ name: "CHANGELOG", category: "Pre-Release", status: "pass", message: `has entry for v${pkg.version}` });
      } else {
        results.push({ name: "CHANGELOG", category: "Pre-Release", status: "warn", message: `no entry for v${pkg.version}` });
      }
    } catch {
      results.push({ name: "CHANGELOG", category: "Pre-Release", status: "warn", message: "Could not verify" });
    }
  }

  // 6. Git working tree clean
  const gitStatus = execQuiet("git", ["status", "--porcelain"]);
  if (gitStatus.ok) {
    const dirty = gitStatus.stdout.trim().split("\n").filter(l => l.trim()).length;
    if (dirty === 0) {
      results.push({ name: "Git status", category: "Pre-Release", status: "pass", message: "working tree clean" });
    } else {
      results.push({ name: "Git status", category: "Pre-Release", status: "warn", message: `${dirty} uncommitted change(s)` });
    }
  }

  // 7. Test suite passes
  //
  // Guard against mutual recursion: tests/setup.test.ts spawns this CLI with
  // --pre-release, and without this check we would spawn a full suite back,
  // which spawns another doctor, unbounded. That produced 40+ orphaned vitest
  // processes per run and starved the machine badly enough to fail unrelated
  // tests on 5s timeouts. vitest sets VITEST in the environment and the spawned
  // CLI inherits it through execFile, so a nested invocation sees it. See #139.
  if (process.env.VITEST) {
    results.push({
      name: "Test suite",
      category: "Pre-Release",
      status: "warn",
      message: "not run — already executing under vitest (see #139)",
    });
    return results;
  }

  const testResult = execQuiet("npx", ["vitest", "run", "--reporter=verbose"], 180_000);
  if (testResult.ok) {
    const match = testResult.stdout.match(/Tests\s+(\d+) passed/);
    const count = match ? match[1] : "?";
    results.push({ name: "Test suite", category: "Pre-Release", status: "pass", message: `${count} tests pass` });
  } else {
    const failMatch = testResult.stdout.match(/(\d+) failed/);
    const failCount = failMatch ? failMatch[1] : "?";
    results.push({ name: "Test suite", category: "Pre-Release", status: "fail", message: `${failCount} test(s) failing` });
  }

  return results;
}

function checkPostRelease(): CheckResult[] {
  const results: CheckResult[] = [];

  // 1. Plugin symlink exists
  const symlinkPath = join(homedir(), ".claude", "plugins", "himalaya-mcp");
  if (existsSync(symlinkPath)) {
    results.push({ name: "Plugin installed", category: "Post-Release", status: "pass", message: symlinkPath });
  } else {
    results.push({ name: "Plugin installed", category: "Post-Release", status: "fail", message: "Not installed. Run: claude plugin install himalaya" });
    return results;
  }

  // 2. plugin.json exists and is valid
  const pluginJsonPath = join(symlinkPath, ".claude-plugin", "plugin.json");
  if (existsSync(pluginJsonPath)) {
    try {
      const plugin = JSON.parse(readFileSync(pluginJsonPath, "utf-8")) as { name: string; version: string };
      results.push({ name: "plugin.json", category: "Post-Release", status: "pass", message: `name=${plugin.name} v${plugin.version}` });
    } catch {
      results.push({ name: "plugin.json", category: "Post-Release", status: "fail", message: "Invalid JSON" });
    }
  } else {
    results.push({ name: "plugin.json", category: "Post-Release", status: "fail", message: "Missing" });
  }

  // 3. MCP server process check (try to start and send initialize)
  const entryPoint = findServerEntry();
  if (existsSync(entryPoint)) {
    try {
      const initMsg = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "doctor", version: "1.0.0" } } });
      const result = execFileSync("node", [entryPoint], {
        input: `Content-Length: ${Buffer.byteLength(initMsg)}\r\n\r\n${initMsg}`,
        timeout: 5_000,
        stdio: "pipe",
      }).toString();
      if (result.includes('"result"') || result.includes('"serverInfo"')) {
        results.push({ name: "MCP handshake", category: "Post-Release", status: "pass", message: "initialize response received" });
      } else {
        results.push({ name: "MCP handshake", category: "Post-Release", status: "warn", message: "Unexpected response" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ name: "MCP handshake", category: "Post-Release", status: "fail", message: `Failed: ${msg.slice(0, 100)}` });
    }
  } else {
    results.push({ name: "MCP handshake", category: "Post-Release", status: "fail", message: "Skipped — dist/index.js not found" });
  }

  // 4. Marketplace entry
  const marketplacePath = join(homedir(), ".claude", "local-marketplace", ".claude-plugin", "marketplace.json");
  if (existsSync(marketplacePath)) {
    try {
      const raw = readFileSync(marketplacePath, "utf-8");
      if (raw.includes("himalaya")) {
        results.push({ name: "Marketplace", category: "Post-Release", status: "pass", message: "registered in local-marketplace" });
      } else {
        results.push({ name: "Marketplace", category: "Post-Release", status: "warn", message: "Not found in marketplace.json" });
      }
    } catch {
      results.push({ name: "Marketplace", category: "Post-Release", status: "warn", message: "Could not read marketplace.json" });
    }
  } else {
    results.push({ name: "Marketplace", category: "Post-Release", status: "warn", message: "local-marketplace not found" });
  }

  // 5. Skills directory
  const skillsPath = join(symlinkPath, "skills");
  if (existsSync(skillsPath)) {
    const skillDirs = readdirSync(skillsPath, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .length;
    results.push({ name: "Skills", category: "Post-Release", status: "pass", message: `${skillDirs} skill directories found` });
  } else {
    results.push({ name: "Skills", category: "Post-Release", status: "warn", message: "skills/ directory not found" });
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

export async function checkAccountHealth(name: string): Promise<AccountHealth> {
  const himalayaPath = whichBin("himalaya");
  if (!himalayaPath) {
    return {
      reachable: false,
      error: "himalaya CLI not found on PATH",
      hint: "Install: brew install himalaya",
    };
  }

  // Route through the same shared probe the health_check tool uses so the
  // two surfaces (folder + envelope) never drift again (#133 lesson). The
  // client handles v1/v2 syntax, JSON output flags, and transient retry.
  let client = clientCache.get(himalayaPath);
  if (!client) {
    client = new HimalayaClient({ binary: himalayaPath, timeout: 15_000 });
    clientCache.set(himalayaPath, client);
  }
  const probe = await probeAccountSurfaces(name, client);
  if (probe.reachable) {
    return { reachable: true };
  }
  const folder = probe.folders;
  return {
    reachable: false,
    error: folder.message || "folder list failed",
    hint: folder.hint,
  };
}

export async function runDoctor(opts: DoctorOptions = {}): Promise<string> {
  const includeBase = opts.includeBaseChecks !== false;
  let results: CheckResult[] = [];

  if (opts.preRelease) {
    results = checkPreRelease();
  } else if (opts.postRelease) {
    results = checkPostRelease();
  } else if (includeBase) {
    results = [
      ...(await checkPrerequisites()),
      ...checkMcpServer(),
      ...(await checkEmailConnectivity()),
      ...checkDesktopExtension(),
      ...checkCodePlugin(),
      ...checkPluginCache(),
      ...checkEnvironment(),
    ];
  }

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

  let accountsToCheck: Account[] = [];
  let anyAccountFailed = false;
  if (!opts.preRelease && !opts.postRelease) {
    lines.push("");
    lines.push("  Accounts");
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
  let results: CheckResult[] = [];

  if (opts.preRelease) {
    results = checkPreRelease();
  } else if (opts.postRelease) {
    results = checkPostRelease();
  } else {
    results = [
      ...(await checkPrerequisites()),
      ...checkMcpServer(),
      ...(await checkEmailConnectivity()),
      ...checkDesktopExtension(),
      ...checkCodePlugin(),
      ...checkPluginCache(),
      ...checkEnvironment(),
    ];
  }

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
  if (!opts.preRelease && !opts.postRelease) {
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
export async function doctor(flags: { fix: boolean; json: boolean; account?: string; preRelease?: boolean; postRelease?: boolean }): Promise<void> {
  if (flags.json) {
    const { output, failed } = await runDoctorJson(flags);
    // process.stdout.write + process.exitCode (not console.log + process.exit)
    // so stdout is flushed before the process exits -- the console.log/exit
    // combo truncated JSON output, breaking `doctor --json` for CI parsers.
    process.stdout.write(output + "\n");
    if (failed > 0) process.exitCode = 1;
    return;
  }

  const output = await runDoctor(flags);
  process.stdout.write(output + "\n");
  if (output.includes("✗")) process.exitCode = 1;
}
