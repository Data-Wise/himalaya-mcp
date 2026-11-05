import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  localProxyServers, passwordCommands, proxyHasStoredToken, himalayaConfigPaths,
  checkMailPath, checkInstallHealth, checkDesktopServerEntry, describeExecFailure,
  type DiagnosticsEnv,
} from "../src/cli/doctor-diagnostics.js";

const PROXY_TOML = `
[accounts.unm]
email = "me@example.edu"
imap.server = "imap://127.0.0.1:1993"
imap.sasl.plain.username = "me@example.edu"
imap.sasl.plain.password.command = "echo me@example.edu"
smtp.server = "smtp://127.0.0.1:1587"
smtp.sasl.plain.password.command = "echo me@example.edu"
`;

let home: string;
beforeEach(() => { home = mkdtempSync(join(tmpdir(), "hm-doctor-diag-")); });
afterEach(() => { rmSync(home, { recursive: true, force: true }); });

function write(rel: string, content: string): string {
  const p = join(home, rel);
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, content);
  return p;
}

function env(over: Partial<DiagnosticsEnv> = {}): DiagnosticsEnv {
  return {
    home, platform: "linux", cwd: home,
    probePort: async () => true,
    processRunning: () => true,
    ...over,
  };
}

describe("parsers", () => {
  it("finds only loopback imap/smtp servers", () => {
    expect(localProxyServers(PROXY_TOML)).toEqual([
      { kind: "imap", host: "127.0.0.1", port: 1993 },
      { kind: "smtp", host: "127.0.0.1", port: 1587 },
    ]);
    expect(localProxyServers('imap.server = "imaps://imap.gmail.com:993"')).toEqual([]);
  });

  it("returns password command text per protocol", () => {
    expect(passwordCommands(PROXY_TOML)).toEqual({
      imap: ["echo me@example.edu"], smtp: ["echo me@example.edu"],
    });
  });

  it("detects stored tokens by key name only, in account sections", () => {
    const cfg = "[emailproxy]\nrefresh_token = nope\n[me@example.edu]\nrefresh_token = abc\naccess_token = def\n";
    expect(proxyHasStoredToken(cfg)).toEqual({ hasRefresh: true, hasAccess: true });
    expect(proxyHasStoredToken("[me@example.edu]\nclient_id = x\n")).toEqual({ hasRefresh: false, hasAccess: false });
  });

  it("prefers the platform dir on macOS", () => {
    const paths = himalayaConfigPaths({ home: "/h", platform: "darwin" });
    expect(paths[0]).toContain("Application Support");
    expect(himalayaConfigPaths({ home: "/h", platform: "linux" })).toHaveLength(1);
  });
});

describe("checkMailPath", () => {
  it("is silent without a himalaya config or with a direct (non-proxy) server", async () => {
    expect(await checkMailPath(env())).toEqual([]);
    write(".config/himalaya/config.toml", 'imap.server = "imaps://imap.example.com:993"');
    expect(await checkMailPath(env())).toEqual([]);
  });

  it("fails when nothing listens on the proxy port", async () => {
    write(".config/himalaya/config.toml", PROXY_TOML);
    const r = await checkMailPath(env({ probePort: async () => false, processRunning: () => false }));
    expect(r.find((x) => x.name === "Proxy port")?.status).toBe("fail");
    expect(r.find((x) => x.name === "Proxy process")?.status).toBe("fail");
  });

  it("warns when the proxy has no stored token (planted defect) and passes when it does", async () => {
    write(".config/himalaya/config.toml", PROXY_TOML);
    const cfg = write(".config/email-oauth2-proxy/emailproxy.config", "[me@example.edu]\nclient_id = x\n");
    let r = await checkMailPath(env());
    expect(r.find((x) => x.name === "Proxy token")?.status).toBe("warn");

    writeFileSync(cfg, "[me@example.edu]\nclient_id = x\nrefresh_token = SECRET-VALUE\n");
    r = await checkMailPath(env());
    const tok = r.find((x) => x.name === "Proxy token");
    expect(tok?.status).toBe("pass");
    expect(JSON.stringify(r)).not.toContain("SECRET-VALUE");
  });

  it("warns when IMAP and SMTP password commands differ", async () => {
    write(".config/himalaya/config.toml", PROXY_TOML.replace("smtp.sasl.plain.password.command = \"echo me@example.edu\"", "smtp.sasl.plain.password.command = \"pass show mail\""));
    const r = await checkMailPath(env());
    expect(r.find((x) => x.name === "Proxy password")?.status).toBe("warn");
  });
});

describe("checkInstallHealth", () => {
  it("warns about shadowing config files on macOS", () => {
    write(".config/himalaya/config.toml", "");
    write("Library/Application Support/himalaya/config.toml", "");
    const r = checkInstallHealth({ home, platform: "darwin", cwd: home }, "2.1.3");
    expect(r.find((x) => x.name === "himalaya config files")?.status).toBe("warn");
  });

  it("warns about a project .mcp.json that uses CLAUDE_PLUGIN_ROOT", () => {
    write(".mcp.json", '{"mcpServers":{"email":{"command":"node","args":["${CLAUDE_PLUGIN_ROOT}/dist/index.js"]}}}');
    const r = checkInstallHealth({ home, platform: "linux", cwd: home }, "2.1.3");
    expect(r.find((x) => x.name === "Project .mcp.json")?.status).toBe("warn");
  });

  it("flags duplicate plugin entries, the legacy name, and version drift", () => {
    write(".claude/plugins/installed_plugins.json", JSON.stringify({
      plugins: { "himalaya@data-wise": [{ version: "2.1.2" }], "himalaya@himalaya-mcp": [{ version: "2.1.3" }] },
    }));
    let r = checkInstallHealth({ home, platform: "linux", cwd: home }, "2.1.3");
    expect(r.find((x) => x.name === "Plugin entries")?.status).toBe("warn");
    expect(r.find((x) => x.name === "Plugin version")?.message).toContain("claude plugin update himalaya@data-wise");

    write(".claude/plugins/installed_plugins.json", JSON.stringify({ plugins: { "email@himalaya-mcp": [{ version: "2.1.3" }] } }));
    r = checkInstallHealth({ home, platform: "linux", cwd: home }, "2.1.3");
    expect(r.find((x) => x.name === "Plugin entries")?.message).toContain("pre-2.0");
  });

  it("passes for a single up-to-date plugin entry", () => {
    write(".claude/plugins/installed_plugins.json", JSON.stringify({ plugins: { "himalaya@data-wise": [{ version: "2.1.3" }] } }));
    const r = checkInstallHealth({ home, platform: "linux", cwd: home }, "2.1.3");
    expect(r.filter((x) => x.status !== "pass")).toEqual([]);
  });
});

describe("checkDesktopServerEntry", () => {
  it("returns nothing when the config or entry is absent", () => {
    expect(checkDesktopServerEntry(join(home, "none.json"), false)).toEqual([]);
    const p = write("c.json", '{"mcpServers":{"zotero":{}}}');
    expect(checkDesktopServerEntry(p, false)).toEqual([]);
  });

  it("fails when the legacy entry points at a missing script and warns on a duplicate extension", () => {
    const p = write("c.json", JSON.stringify({ mcpServers: { himalaya: { command: "node", args: ["/nope/dist/index.js"] } } }));
    expect(checkDesktopServerEntry(p, false)[0].status).toBe("fail");

    const script = write("srv/index.js", "");
    const p2 = write("c2.json", JSON.stringify({ mcpServers: { himalaya: { command: "node", args: [script] } } }));
    const r = checkDesktopServerEntry(p2, true);
    expect(r[0].status).toBe("pass");
    expect(r.find((x) => x.name === "Duplicate server")?.status).toBe("warn");
  });
});

describe("describeExecFailure", () => {
  it("reports timeouts with the limit", () => {
    expect(describeExecFailure({ code: "ETIMEDOUT" }, 20_000)).toContain("timed out after 20s");
  });

  it("extracts himalaya's JSON error", () => {
    const msg = describeExecFailure({ stderr: Buffer.from('{"error":"stream stopped responding after 60s","sources":[]}') }, 10_000);
    expect(msg).toBe("stream stopped responding after 60s");
  });

  it("falls back to the first plain stderr line", () => {
    expect(describeExecFailure({ stderr: "Error: boom\nmore" }, 10_000)).toBe("boom");
    expect(describeExecFailure(new Error("Command failed: himalaya x\nstuff"), 10_000)).toBe("Command failed: himalaya x");
  });
});
