/**
 * Tests for health_check MCP tool.
 *
 * Covers multi-account probing, status classification
 * (healthy / degraded / broken), account-scoping, and the
 * zero-accounts edge case.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as accountsMod from "../src/himalaya/accounts.js";
import { HimalayaClient } from "../src/himalaya/client.js";
import { HimalayaError } from "../src/himalaya/errors.js";
import { handleHealthCheck } from "../src/tools/health.js";

describe("health_check tool", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Multi-surface probing: health_check now probes BOTH folder and envelope
    // surfaces per account, and reports the himalaya version + binary path.
    // These default spies keep every test hermetic (no real subprocess).
    vi.spyOn(HimalayaClient.prototype, "listEnvelopes").mockResolvedValue("[]");
    vi.spyOn(HimalayaClient.prototype, "resolveVersion").mockResolvedValue({
      major: 2,
      raw: "himalaya v2.0.0 +gmail +jmap +msgraph +smtp +rustls-ring +imap +m2dir",
    });
  });

  it("returns overall: healthy when all accounts reachable", async () => {
    vi.spyOn(accountsMod, "listAccounts").mockResolvedValue([
      { name: "unm", isDefault: true },
      { name: "personal", isDefault: false },
    ]);
    vi.spyOn(HimalayaClient.prototype, "listFolders").mockResolvedValue("[]");

    const client = new HimalayaClient({ retryBackoffMs: 0 });
    const result = await handleHealthCheck({}, client);
    const body = JSON.parse(result.content[0].text);
    expect(body.overall).toBe("healthy");
    expect(body.accounts).toHaveLength(2);
    expect(body.accounts.every((a: any) => a.reachable)).toBe(true);
  });

  it("returns overall: degraded when some accounts fail", async () => {
    vi.spyOn(accountsMod, "listAccounts").mockResolvedValue([
      { name: "unm", isDefault: true },
      { name: "personal", isDefault: false },
    ]);
    let call = 0;
    vi.spyOn(HimalayaClient.prototype, "listFolders").mockImplementation(
      async () => {
        call += 1;
        if (call === 1) {
          throw new HimalayaError({
            code: "imap_auth_failed",
            message: "AUTHENTICATIONFAILED",
            hint: "Re-run himalaya account configure",
            account: "unm",
            recoverable: true,
          });
        }
        return "[]";
      },
    );

    const client = new HimalayaClient({ retryBackoffMs: 0 });
    const result = await handleHealthCheck({}, client);
    const body = JSON.parse(result.content[0].text);
    expect(body.overall).toBe("degraded");
    const unm = body.accounts.find((a: any) => a.name === "unm");
    expect(unm.reachable).toBe(false);
    expect(unm.code).toBe("imap_auth_failed");
    expect(unm.hint).toBeTruthy();
  });

  it("returns overall: broken when all accounts fail", async () => {
    vi.spyOn(accountsMod, "listAccounts").mockResolvedValue([
      { name: "unm", isDefault: true },
    ]);
    vi.spyOn(HimalayaClient.prototype, "listFolders").mockImplementation(
      async () => {
        throw new HimalayaError({
          code: "transient",
          message: "ECONNRESET",
          account: "unm",
          recoverable: true,
          attempts: 2,
        });
      },
    );

    const client = new HimalayaClient({ retryBackoffMs: 0 });
    const result = await handleHealthCheck({}, client);
    const body = JSON.parse(result.content[0].text);
    expect(body.overall).toBe("broken");
  });

  it("scopes to a single account when account arg provided", async () => {
    const spy = vi.spyOn(accountsMod, "listAccounts").mockResolvedValue([
      { name: "unm", isDefault: true },
      { name: "personal", isDefault: false },
    ]);
    vi.spyOn(HimalayaClient.prototype, "listFolders").mockResolvedValue("[]");

    const client = new HimalayaClient({ retryBackoffMs: 0 });
    const result = await handleHealthCheck({ account: "personal" }, client);
    const body = JSON.parse(result.content[0].text);
    expect(body.accounts).toHaveLength(1);
    expect(body.accounts[0].name).toBe("personal");
    expect(spy).toHaveBeenCalled();
  });

  it("reports himalaya version and binary path", async () => {
    vi.spyOn(accountsMod, "listAccounts").mockResolvedValue([
      { name: "unm", isDefault: true },
    ]);
    vi.spyOn(HimalayaClient.prototype, "listFolders").mockResolvedValue("[]");

    const client = new HimalayaClient({ retryBackoffMs: 0 });
    const result = await handleHealthCheck({}, client);
    const body = JSON.parse(result.content[0].text);
    expect(body.himalayaVersion).toMatch(/himalaya v2\.0\.0/);
    expect(body.himalayaBinary).toBeTruthy();
  });

  it("exposes folder + envelope surfaces per account", async () => {
    vi.spyOn(accountsMod, "listAccounts").mockResolvedValue([
      { name: "unm", isDefault: true },
    ]);
    vi.spyOn(HimalayaClient.prototype, "listFolders").mockResolvedValue("[]");

    const client = new HimalayaClient({ retryBackoffMs: 0 });
    const result = await handleHealthCheck({}, client);
    const body = JSON.parse(result.content[0].text);
    const unm = body.accounts[0];
    expect(unm.surfaces).toBeTruthy();
    expect(unm.surfaces.folders.ok).toBe(true);
    expect(unm.surfaces.envelopes.ok).toBe(true);
  });

  it("degrades overall when envelopes fail but folders work", async () => {
    vi.spyOn(accountsMod, "listAccounts").mockResolvedValue([
      { name: "unm", isDefault: true },
    ]);
    vi.spyOn(HimalayaClient.prototype, "listFolders").mockResolvedValue("[]");
    vi.spyOn(HimalayaClient.prototype, "listEnvelopes").mockImplementation(
      async () => {
        throw new HimalayaError({
          code: "imap_auth_failed",
          message: "AUTHENTICATIONFAILED",
          hint: "Re-run himalaya account configure",
          account: "unm",
          recoverable: true,
        });
      },
    );

    const client = new HimalayaClient({ retryBackoffMs: 0 });
    const result = await handleHealthCheck({}, client);
    const body = JSON.parse(result.content[0].text);
    // Folder surface is primary: account stays reachable, but the failing
    // envelope surface drives overall to degraded and is reported in surfaces.
    expect(body.overall).toBe("degraded");
    expect(body.accounts[0].reachable).toBe(true);
    expect(body.accounts[0].surfaces.folders.ok).toBe(true);
    expect(body.accounts[0].surfaces.envelopes.ok).toBe(false);
    expect(body.accounts[0].surfaces.envelopes.code).toBe("imap_auth_failed");
  });

  it("handles 'no accounts configured'", async () => {
    vi.spyOn(accountsMod, "listAccounts").mockResolvedValue([]);
    const client = new HimalayaClient({ retryBackoffMs: 0 });
    const result = await handleHealthCheck({}, client);
    const body = JSON.parse(result.content[0].text);
    expect(body.overall).toBe("broken");
    expect(body.accounts).toHaveLength(0);
    expect(body.hint).toMatch(/himalaya account configure/i);
  });
});
