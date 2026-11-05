import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findExtensionIds } from "../src/cli/shared.js";
import { checkDesktopExtension, type DesktopPaths } from "../src/cli/doctor.js";

const NAMESPACED = "local.mcpb.data-wise.himalaya-mcp";
const LEGACY = "himalaya-mcp";

let root: string;
let paths: DesktopPaths;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "hm-doctor-ext-"));
  paths = {
    extensionsDir: join(root, "Claude Extensions"),
    settingsDir: join(root, "Claude Extensions Settings"),
    installationsPath: join(root, "extensions-installations.json"),
  };
  mkdirSync(paths.extensionsDir, { recursive: true });
});
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

function install(id: string, withManifest = true): void {
  mkdirSync(join(paths.extensionsDir, id), { recursive: true });
  if (withManifest) writeFileSync(join(paths.extensionsDir, id, "manifest.json"), '{"manifest_version":"0.3"}');
}

describe("findExtensionIds", () => {
  it("returns [] when the directory is missing or empty", () => {
    expect(findExtensionIds(join(root, "nope"))).toEqual([]);
    expect(findExtensionIds(paths.extensionsDir)).toEqual([]);
  });

  it("finds Desktop's namespaced id and the install-ext id", () => {
    install(NAMESPACED);
    expect(findExtensionIds(paths.extensionsDir)).toEqual([NAMESPACED]);
    rmSync(join(paths.extensionsDir, NAMESPACED), { recursive: true });
    install(LEGACY);
    expect(findExtensionIds(paths.extensionsDir)).toEqual([LEGACY]);
  });

  it("lists Desktop's own install first when both exist", () => {
    install(LEGACY);
    install(NAMESPACED);
    expect(findExtensionIds(paths.extensionsDir)).toEqual([NAMESPACED, LEGACY]);
  });

  it("ignores unrelated extensions and directories without a manifest", () => {
    install("local.mcpb.someone.other-extension");
    install("local.mcpb.data-wise.not-himalaya-mcp-x");
    install(NAMESPACED, false);
    expect(findExtensionIds(paths.extensionsDir)).toEqual([]);
  });
});

describe("checkDesktopExtension with Desktop's namespaced install", () => {
  it("passes and reads registry and settings under the namespaced id", () => {
    install(NAMESPACED);
    mkdirSync(paths.settingsDir, { recursive: true });
    writeFileSync(join(paths.settingsDir, `${NAMESPACED}.json`), JSON.stringify({ isEnabled: true, userConfig: {} }));
    writeFileSync(paths.installationsPath, JSON.stringify({ extensions: { [NAMESPACED]: { id: NAMESPACED } } }));

    const r = checkDesktopExtension(paths);
    expect(r.find((x) => x.name === "Extension installed")?.status).toBe("pass");
    expect(r.find((x) => x.name === "Registry entry")?.status).toBe("pass");
    expect(r.find((x) => x.name === "Settings file")?.status).toBe("pass");
    expect(r.some((x) => x.name === "Duplicate extension")).toBe(false);
  });

  it("fails with the install hint when nothing is installed (negative control)", () => {
    const r = checkDesktopExtension(paths);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ name: "Extension installed", status: "fail" });
    expect(r[0].message).toContain("install-ext");
  });

  it("warns when installed under both ids", () => {
    install(NAMESPACED);
    install(LEGACY);
    const r = checkDesktopExtension(paths);
    expect(r.find((x) => x.name === "Extension installed")?.status).toBe("pass");
    expect(r.find((x) => x.name === "Duplicate extension")?.status).toBe("warn");
  });

  it("still passes for the install-ext id", () => {
    install(LEGACY);
    expect(checkDesktopExtension(paths).find((x) => x.name === "Extension installed")?.status).toBe("pass");
  });
});
