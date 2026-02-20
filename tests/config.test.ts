import { describe, it, expect, vi, afterEach } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns empty config when no env vars set", () => {
    delete process.env.HIMALAYA_BINARY;
    delete process.env.HIMALAYA_ACCOUNT;
    delete process.env.HIMALAYA_FOLDER;
    delete process.env.HIMALAYA_TIMEOUT;

    const config = loadConfig();
    expect(config).toEqual({});
  });

  it("reads HIMALAYA_BINARY", () => {
    process.env.HIMALAYA_BINARY = "/usr/local/bin/himalaya";
    const config = loadConfig();
    expect(config.binary).toBe("/usr/local/bin/himalaya");
  });

  it("reads HIMALAYA_ACCOUNT", () => {
    process.env.HIMALAYA_ACCOUNT = "work";
    const config = loadConfig();
    expect(config.account).toBe("work");
  });

  it("reads HIMALAYA_FOLDER", () => {
    process.env.HIMALAYA_FOLDER = "Sent Items";
    const config = loadConfig();
    expect(config.folder).toBe("Sent Items");
  });

  it("reads HIMALAYA_TIMEOUT as number", () => {
    process.env.HIMALAYA_TIMEOUT = "60000";
    const config = loadConfig();
    expect(config.timeout).toBe(60000);
  });

  it("ignores invalid HIMALAYA_TIMEOUT", () => {
    process.env.HIMALAYA_TIMEOUT = "not-a-number";
    const config = loadConfig();
    expect(config.timeout).toBeUndefined();
  });

  it("accepts HIMALAYA_TIMEOUT of 0 (unlimited)", () => {
    process.env.HIMALAYA_TIMEOUT = "0";
    const config = loadConfig();
    expect(config.timeout).toBe(0);
  });

  it("ignores negative HIMALAYA_TIMEOUT", () => {
    process.env.HIMALAYA_TIMEOUT = "-1000";
    const config = loadConfig();
    expect(config.timeout).toBeUndefined();
  });

  it("ignores unresolved template variables from .mcpb", () => {
    process.env.HIMALAYA_BINARY = "${user_config.himalaya_binary}";
    process.env.HIMALAYA_ACCOUNT = "${user_config.himalaya_account}";
    process.env.HIMALAYA_FOLDER = "${user_config.himalaya_folder}";
    process.env.HIMALAYA_TIMEOUT = "${user_config.himalaya_timeout}";

    const config = loadConfig();
    expect(config).toEqual({});
  });
});
