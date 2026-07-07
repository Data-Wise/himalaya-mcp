/**
 * Tests for himalaya config.toml parser and from-address resolution.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, unlinkSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveFromAddress, parseConfigToml } from "../src/himalaya/config-toml.js";

let tempDir: string;
let configPath: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "himalaya-test-"));
  configPath = join(tempDir, "config.toml");
  // Prevent real config.toml from being read
  process.env["HIMALAYA_CONFIG"] = join(tempDir, "nonexistent.toml");
  delete process.env["HIMALAYA_FROM"];
  delete process.env["HIMALAYA_ACCOUNT"];
});

afterEach(() => {
  try { unlinkSync(configPath); } catch {}
  try { unlinkSync(join(tempDir, "nonexistent.toml")); } catch {}
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
});
