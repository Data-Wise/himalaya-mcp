/**
 * Extra doctor diagnostics: local OAuth proxy ("Mail Path"), install shadowing
 * ("Install Health"), and the legacy Claude Desktop server entry.
 *
 * Every function takes an options object so tests can point it at a temp HOME
 * and stub process/network probes. Nothing here prints or returns secret
 * values: token checks look at key *names* only.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";
import { createConnection } from "node:net";
import type { CheckResult } from "./doctor.js";

const MAIL = "Mail Path";
const INSTALL = "Install Health";
const DESKTOP = "Desktop Extension";
const PROXY_DOC = "docs/guide/microsoft-365-oauth-proxy.md";

export interface DiagnosticsEnv {
  home: string;
  platform: NodeJS.Platform;
  cwd: string;
  /** Resolve true when something accepts TCP connections on host:port. */
  probePort: (host: string, port: number) => Promise<boolean>;
  /** True when a process whose command line contains `pattern` is running. */
  processRunning: (pattern: string) => boolean;
}

export function defaultEnv(): DiagnosticsEnv {
  return {
    home: homedir(),
    platform: process.platform,
    cwd: process.cwd(),
    probePort: (host, port) =>
      new Promise((resolve) => {
        const sock = createConnection({ host, port });
        const done = (ok: boolean) => { sock.destroy(); resolve(ok); };
        sock.setTimeout(2000, () => done(false));
        sock.once("connect", () => done(true));
        sock.once("error", () => done(false));
      }),
    processRunning: (pattern) => {
      try {
        return execFileSync("pgrep", ["-f", pattern], { stdio: "pipe" }).toString().trim().length > 0;
      } catch {
        return false;
      }
    },
  };
}

function readText(path: string): string | null {
  try { return readFileSync(path, "utf-8"); } catch { return null; }
}

/** himalaya config files in the order himalaya prefers them (platform dir first on macOS). */
export function himalayaConfigPaths(env: Pick<DiagnosticsEnv, "home" | "platform">): string[] {
  const xdg = join(env.home, ".config", "himalaya", "config.toml");
  if (env.platform === "darwin") {
    return [join(env.home, "Library", "Application Support", "himalaya", "config.toml"), xdg];
  }
  return [xdg];
}

interface LocalServer { kind: "imap" | "smtp"; host: string; port: number }

/** Extract `imap.server` / `smtp.server` URLs that point at this machine. */
export function localProxyServers(toml: string): LocalServer[] {
  const out: LocalServer[] = [];
  const re = /^\s*(imap|smtp)\.server\s*=\s*"([a-z]+):\/\/([^":/]+|\[[^\]]+\]):(\d+)"/gim;
  for (const m of toml.matchAll(re)) {
    const host = m[3].replace(/^\[|\]$/g, "");
    if (["127.0.0.1", "localhost", "::1"].includes(host)) {
      out.push({ kind: m[1].toLowerCase() as "imap" | "smtp", host, port: Number(m[4]) });
    }
  }
  return out;
}

/** Return the value of each `<imap|smtp>.sasl.plain.password.command` line (command text, not output). */
export function passwordCommands(toml: string): { imap: string[]; smtp: string[] } {
  const out = { imap: [] as string[], smtp: [] as string[] };
  const re = /^\s*(imap|smtp)\.sasl\.plain\.password\.command\s*=\s*"((?:[^"\\]|\\.)*)"/gim;
  for (const m of toml.matchAll(re)) out[m[1].toLowerCase() as "imap" | "smtp"].push(m[2]);
  return out;
}

/** Does any [section] of an email-oauth2-proxy config hold a stored refresh token? Key names only. */
export function proxyHasStoredToken(config: string): { hasRefresh: boolean; hasAccess: boolean } {
  let section = "";
  let hasRefresh = false;
  let hasAccess = false;
  for (const line of config.split("\n")) {
    const s = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (s) { section = s[1]; continue; }
    if (!section.includes("@")) continue; // account sections are named after the login
    const key = line.match(/^\s*([a-z_]+)\s*=\s*\S/i)?.[1];
    if (key === "refresh_token") hasRefresh = true;
    if (key === "access_token") hasAccess = true;
  }
  return { hasRefresh, hasAccess };
}

export async function checkMailPath(env: DiagnosticsEnv = defaultEnv()): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  let toml: string | null = null;
  for (const p of himalayaConfigPaths(env)) {
    toml = readText(p);
    if (toml !== null) break;
  }
  if (toml === null) return results; // no config: prerequisites/account checks already report it

  const servers = localProxyServers(toml);
  if (servers.length === 0) return results; // direct IMAP/SMTP: no local proxy to diagnose

  const imap = servers.find((s) => s.kind === "imap") ?? servers[0];
  const open = await env.probePort(imap.host, imap.port);
  results.push(open
    ? {
      name: "Proxy port", category: MAIL, status: "pass",
      message: `${imap.host}:${imap.port} accepting connections (a listening port does not prove a valid token)`,
    }
    : {
      name: "Proxy port", category: MAIL, status: "fail",
      message: `Nothing listening on ${imap.host}:${imap.port}. Start the OAuth proxy (macOS: launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.emailproxy.plist).`,
    });

  const running = env.processRunning("emailproxy");
  results.push(running
    ? { name: "Proxy process", category: MAIL, status: "pass", message: "emailproxy is running" }
    : {
      name: "Proxy process", category: MAIL, status: open ? "warn" : "fail",
      message: open
        ? "No local emailproxy process found, but the port is open (another proxy or a remote forward?)"
        : "emailproxy is not running",
    });

  const proxyDir = join(env.home, ".config", "email-oauth2-proxy");
  const proxyConfig = ["emailproxy.config", "email-oauth2-proxy.config"]
    .map((f) => join(proxyDir, f)).find((p) => existsSync(p));
  if (proxyConfig) {
    const tokens = proxyHasStoredToken(readText(proxyConfig) ?? "");
    results.push(tokens.hasRefresh
      ? { name: "Proxy token", category: MAIL, status: "pass", message: "refresh token stored" }
      : {
        name: "Proxy token", category: MAIL, status: "warn",
        message: `No stored refresh token in ${proxyConfig}. The next connection waits for a device-code sign-in (himalaya gives up after 60s); see ${PROXY_DOC}.`,
      });
  }

  const cmds = passwordCommands(toml);
  if (cmds.imap.length > 0 && cmds.smtp.length > 0) {
    const same = cmds.imap.length === cmds.smtp.length && cmds.imap.every((c, i) => c === cmds.smtp[i]);
    results.push(same
      ? { name: "Proxy password", category: MAIL, status: "pass", message: "IMAP and SMTP password commands match" }
      : {
        name: "Proxy password", category: MAIL, status: "warn",
        message: `IMAP and SMTP password commands differ. The proxy derives its token key from the password, so a changed value discards the stored token; see ${PROXY_DOC}.`,
      });
  }

  return results;
}

export function checkInstallHealth(
  env: Pick<DiagnosticsEnv, "home" | "platform" | "cwd">,
  binaryVersion: string,
): CheckResult[] {
  const results: CheckResult[] = [];

  const configs = himalayaConfigPaths(env).filter((p) => existsSync(p));
  if (configs.length > 1) {
    results.push({
      name: "himalaya config files", category: INSTALL, status: "warn",
      message: `Found ${configs.length}: ${configs.join(" and ")}. On macOS the platform directory wins, so edits to the other are ignored.`,
    });
  } else if (configs.length === 1) {
    results.push({ name: "himalaya config files", category: INSTALL, status: "pass", message: configs[0] });
  }

  const projectMcp = readText(join(env.cwd, ".mcp.json"));
  if (projectMcp !== null && projectMcp.includes("CLAUDE_PLUGIN_ROOT")) {
    results.push({
      name: "Project .mcp.json", category: INSTALL, status: "warn",
      message: `${join(env.cwd, ".mcp.json")} uses \${CLAUDE_PLUGIN_ROOT}, which is unset outside a plugin: it starts a failing duplicate "email" server that shadows the plugin (removed in 2.1.3; delete the file or update the clone).`,
    });
  }

  const installedRaw = readText(join(env.home, ".claude", "plugins", "installed_plugins.json"));
  if (installedRaw !== null) {
    try {
      const plugins = (JSON.parse(installedRaw) as { plugins?: Record<string, unknown[]> }).plugins ?? {};
      const keys = Object.keys(plugins).filter((k) => /^(himalaya|email)@/.test(k));
      if (keys.length > 1) {
        results.push({
          name: "Plugin entries", category: INSTALL, status: "warn",
          message: `Installed from more than one source: ${keys.join(", ")}. Keep one (claude plugin uninstall <name>@<marketplace>).`,
        });
      } else if (keys.length === 1 && keys[0].startsWith("email@")) {
        results.push({
          name: "Plugin entries", category: INSTALL, status: "warn",
          message: `${keys[0]} is the pre-2.0 plugin name. Install "himalaya" instead.`,
        });
      } else if (keys.length === 1) {
        results.push({ name: "Plugin entries", category: INSTALL, status: "pass", message: keys[0] });
      }

      for (const key of keys) {
        const entry = (plugins[key]?.[0] ?? {}) as { version?: string };
        if (entry.version && binaryVersion && entry.version !== binaryVersion) {
          results.push({
            name: "Plugin version", category: INSTALL, status: "warn",
            message: `${key} is ${entry.version} but himalaya-mcp is ${binaryVersion}. Run: claude plugin update ${key}`,
          });
        }
      }
    } catch {
      results.push({ name: "Plugin entries", category: INSTALL, status: "warn", message: "installed_plugins.json is not valid JSON" });
    }
  }

  return results;
}

/** The legacy claude_desktop_config.json server entry (himalaya-mcp setup). */
export function checkDesktopServerEntry(configPath: string, extensionInstalled: boolean): CheckResult[] {
  const raw = readText(configPath);
  if (raw === null) return [];
  let servers: Record<string, { command?: string; args?: string[] }> = {};
  try {
    servers = (JSON.parse(raw) as { mcpServers?: typeof servers }).mcpServers ?? {};
  } catch {
    return [{ name: "Legacy server entry", category: DESKTOP, status: "warn", message: `${configPath} is not valid JSON` }];
  }
  const entry = servers["himalaya"];
  if (!entry) return [];

  const results: CheckResult[] = [];
  const script = entry.args?.find((a) => a.endsWith(".js"));
  if (script && !existsSync(script.replace(/^~(?=\/)/, process.env.HOME ?? ""))) {
    results.push({
      name: "Legacy server entry", category: DESKTOP, status: "fail",
      message: `claude_desktop_config.json points at ${script}, which does not exist. Run: himalaya-mcp setup`,
    });
  } else {
    results.push({ name: "Legacy server entry", category: DESKTOP, status: "pass", message: script ?? "present" });
  }
  if (extensionInstalled) {
    results.push({
      name: "Duplicate server", category: DESKTOP, status: "warn",
      message: "Both the .mcpb extension and a legacy mcpServers.himalaya entry exist, so Desktop may run two copies. Remove one (himalaya-mcp setup --remove).",
    });
  }
  return results;
}

/** Condense an execFileSync failure into one actionable line (no secrets, no full command line). */
export function describeExecFailure(err: unknown, timeoutMs: number): string {
  const e = err as { code?: string; killed?: boolean; stderr?: Buffer | string; stdout?: Buffer | string; message?: string };
  if (e?.code === "ETIMEDOUT" || e?.killed) {
    return `timed out after ${Math.round(timeoutMs / 1000)}s (often a mail server or OAuth proxy waiting for sign-in)`;
  }
  for (const stream of [e?.stderr, e?.stdout]) {
    const text = stream ? stream.toString().trim() : "";
    if (!text) continue;
    try {
      const j = JSON.parse(text) as { error?: unknown };
      if (typeof j.error === "string") return j.error.split("\n")[0].slice(0, 200);
    } catch { /* plain text */ }
    return text.split("\n")[0].replace(/^Error:\s*/, "").slice(0, 200);
  }
  return (e?.message ?? String(err)).split("\n")[0].slice(0, 200);
}
