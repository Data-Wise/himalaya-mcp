/**
 * Tests for himalaya config.toml parser and from-address resolution.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveFromAddress, parseConfigToml } from "../src/himalaya/config-toml.js";

let tempDir: string;
let configPath: string;
const originalEnv = { ...process.env };

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "himalaya-test-"));
  configPath = join(tempDir, "config.toml");
  // Prevent real config.toml from being read
  process.env["HIMALAYA_CONFIG"] = join(tempDir, "nonexistent.toml");
  delete process.env["HIMALAYA_FROM"];
  delete process.env["HIMALAYA_ACCOUNT"];
});

afterEach(() => {
  process.env = { ...originalEnv };
  rmSync(tempDir, { recursive: true, force: true });
});

function writeConfig(content: string) {
  writeFileSync(configPath, content, "utf-8");
  process.env["HIMALAYA_CONFIG"] = configPath;
}

describe("parseConfigToml", () => {
  it("parses single account with email and default", () => {
    writeConfig(`
[accounts.personal]
email = "me@example.com"
default = true
backend.type = "imap"
`);
    const result = parseConfigToml(configPath);
    expect(result.accounts.get("personal")).toEqual({
      email: "me@example.com",
      isDefault: true,
    });
  });

  it("parses multiple accounts", () => {
    writeConfig(`
[accounts.personal]
email = "personal@example.com"
default = true

[accounts.work]
email = "work@example.com"
default = false
`);
    const result = parseConfigToml(configPath);
    expect(result.accounts.size).toBe(2);
    expect(result.accounts.get("personal")?.email).toBe("personal@example.com");
    expect(result.accounts.get("work")?.email).toBe("work@example.com");
  });

  it("handles single-quoted email values", () => {
    writeConfig(`
[accounts.personal]
email = 'single@example.com'
default = true
`);
    const result = parseConfigToml(configPath);
    expect(result.accounts.get("personal")?.email).toBe("single@example.com");
  });

  it("handles comments and quoted account names", () => {
    writeConfig(`
[accounts."work.personal"]
email = "work@example.com" # inline comment
default = true # another comment
`);
    const result = parseConfigToml(configPath);
    expect(result.accounts.get("work.personal")).toEqual({
      email: "work@example.com",
      isDefault: true,
    });
  });

  it("handles account without email", () => {
    writeConfig(`
[accounts.personal]
default = true
`);
    const result = parseConfigToml(configPath);
    expect(result.accounts.get("personal")?.email).toBe("");
  });

  it("handles account with display-name but no default", () => {
    writeConfig(`
[accounts.personal]
email = "me@example.com"
display-name = "John Doe"
`);
    const result = parseConfigToml(configPath);
    expect(result.accounts.get("personal")?.isDefault).toBe(false);
  });

  it("returns empty map for empty config", () => {
    writeConfig("");
    const result = parseConfigToml(configPath);
    expect(result.accounts.size).toBe(0);
  });
});

describe("resolveFromAddress", () => {
  it("returns HIMALAYA_FROM env var when set (takes priority)", () => {
    writeConfig(`
[accounts.personal]
email = "config@example.com"
default = true
`);
    process.env["HIMALAYA_FROM"] = "env@example.com";
    const result = resolveFromAddress();
    expect(result).toBe("env@example.com");
  });

  it("falls back to config.toml default account email", () => {
    writeConfig(`
[accounts.personal]
email = "default@example.com"
default = true
`);
    const result = resolveFromAddress();
    expect(result).toBe("default@example.com");
  });

  it("falls back to explicit HIMALAYA_ACCOUNT email", () => {
    writeConfig(`
[accounts.personal]
email = "primary@example.com"
default = true

[accounts.sanlam]
email = "sanlam@example.com"
default = false
`);
    process.env["HIMALAYA_ACCOUNT"] = "sanlam";
    const result = resolveFromAddress("sanlam");
    expect(result).toBe("sanlam@example.com");
  });

  it("returns first account with email when no default", () => {
    writeConfig(`
[accounts.work]
email = "work@example.com"

[accounts.home]
email = "home@example.com"
`);
    const result = resolveFromAddress();
    expect(result).toBe("work@example.com");
  });

  it("returns undefined when config file missing", () => {
    // beforeEach already points to nonexistent path, no writeConfig called
    const result = resolveFromAddress();
    expect(result).toBeUndefined();
  });

  it("returns undefined when no email in config", () => {
    writeConfig(`
[accounts.personal]
default = true
`);
    const result = resolveFromAddress();
    expect(result).toBeUndefined();
  });

  it("reads the XDG config location when no override is set", () => {
    delete process.env["HIMALAYA_CONFIG"];
    const xdgHome = join(tempDir, "xdg");
    mkdirSync(join(xdgHome, "himalaya"), { recursive: true });
    writeFileSync(join(xdgHome, "himalaya", "config.toml"), `
[accounts.xdg]
email = "xdg@example.com"
default = true
`, "utf-8");
    process.env["XDG_CONFIG_HOME"] = xdgHome;

    expect(resolveFromAddress()).toBe("xdg@example.com");
  });

  it("reads the legacy home config location", () => {
    delete process.env["HIMALAYA_CONFIG"];
    process.env["XDG_CONFIG_HOME"] = join(tempDir, "missing-xdg");
    process.env["HOME"] = tempDir;
    writeFileSync(join(tempDir, ".himalayarc"), `
[accounts.legacy]
email = "legacy@example.com"
default = true
`, "utf-8");

    expect(resolveFromAddress()).toBe("legacy@example.com");
  });
});

describe("display-name", () => {
  it("formats a From header only when a display name is known", async () => {
    const { formatFromHeader } = await import("../src/himalaya/config-toml.js");
    expect(formatFromHeader("a@b.c", "Ada Lovelace")).toBe('"Ada Lovelace" <a@b.c>');
    expect(formatFromHeader("a@b.c")).toBe("a@b.c");
    expect(formatFromHeader("Ada <a@b.c>", "Other")).toBe("Ada <a@b.c>");
  });

  it("parses display-name per account and resolves it for the default account", async () => {
    const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const { parseConfigToml, resolveDisplayName } = await import("../src/himalaya/config-toml.js");
    const dir = mkdtempSync(join(tmpdir(), "display-name-"));
    const path = join(dir, "config.toml");
    writeFileSync(path, [
      "[accounts.work]", "default = true", 'email = "w@example.com"', 'display-name = "Work Name"',
      "[accounts.home]", 'email = "h@example.com"',
    ].join("\n"));
    const saved = { cfg: process.env["HIMALAYA_CONFIG"], from: process.env["HIMALAYA_FROM"] };
    try {
      expect(parseConfigToml(path).accounts.get("work")?.displayName).toBe("Work Name");
      process.env["HIMALAYA_CONFIG"] = path;
      delete process.env["HIMALAYA_FROM"];
      expect(resolveDisplayName()).toBe("Work Name");
      expect(resolveDisplayName("home")).toBeUndefined();
      process.env["HIMALAYA_FROM"] = "x@example.com";
      expect(resolveDisplayName()).toBeUndefined();
    } finally {
      if (saved.cfg === undefined) delete process.env["HIMALAYA_CONFIG"]; else process.env["HIMALAYA_CONFIG"] = saved.cfg;
      if (saved.from === undefined) delete process.env["HIMALAYA_FROM"]; else process.env["HIMALAYA_FROM"] = saved.from;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

