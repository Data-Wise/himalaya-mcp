/**
 * himalaya-mcp extension CLI — install/remove the .mcpb Desktop extension.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  EXTENSION_ID,
  EXTENSIONS_DIR,
  EXTENSIONS_SETTINGS_DIR,
  INSTALLATIONS_PATH,
} from "./shared.js";

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
    (f: string) => f.startsWith("himalaya-mcp-v") && f.endsWith(".mcpb"),
  );

  if (files.length === 0) {
    console.error("Error: No .mcpb file found. Run: npm run build:mcpb");
    process.exit(1);
  }

  files.sort();
  return join(projectRoot, files[files.length - 1]);
}

export function installExtension(mcpbPath?: string): void {
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
      "utf-8",
    );
  }

  console.log(`Installed himalaya-mcp v${manifest.version} as Claude Desktop extension.`);
  console.log(`  Extension dir: ${extDir}`);
  console.log(`  Settings: ${settingsPath}`);
  console.log("  Restart Claude Desktop to activate.");
}

export function removeExtension(): void {
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
