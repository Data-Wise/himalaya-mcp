#!/usr/bin/env node
/**
 * himalaya-mcp CLI — main dispatcher.
 *
 * Routes to one of the per-command modules:
 *   setup       -> ./setup.js     (setup / check / remove)
 *   doctor      -> ./doctor.js    (doctor --fix / --json / --account)
 *   install-ext -> ./extension.js (install .mcpb)
 *   remove-ext  -> ./extension.js (remove .mcpb)
 *   --help / --version / unknown
 *
 * Imported as a library, the main dispatcher does nothing (no side effects).
 */

import { isMain, getVersion, parseAccountFlag, printHelp } from "./shared.js";
import { fileURLToPath } from "node:url";
import { setup, check as setupCheck, remove as setupRemove } from "./setup.js";
import { doctor } from "./doctor.js";
import { installExtension, removeExtension } from "./extension.js";

export { setup, setupCheck, setupRemove, doctor, installExtension, removeExtension };
export { isMain, getVersion, parseAccountFlag, printHelp };
export * from "./shared.js";
export * from "./setup.js";
export * from "./doctor.js";
export * from "./extension.js";

async function runCli(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "--help" || command === "-h" || command === "help") {
    printHelp();
  } else if (command === "--version" || command === "-v" || command === "version") {
    const version = getVersion();
    console.log(version || "unknown");
  } else if (command === "--check" || command === "check") {
    setupCheck();
  } else if (command === "--remove" || command === "remove") {
    setupRemove();
  } else if (command === "install-ext") {
    installExtension(args[1]);
  } else if (command === "remove-ext") {
    removeExtension();
  } else if (command === "doctor") {
    const fix = args.includes("--fix");
    const json = args.includes("--json");
    const account = parseAccountFlag(args);
    await doctor({ fix, json, account });
  } else if (!command || command === "setup") {
    setup();
  } else {
    console.error(`himalaya-mcp: unknown command '${command}'`);
    console.error("Run 'himalaya-mcp --help' for usage.");
    process.exit(1);
  }
}

if (isMain(import.meta.url)) {
  void runCli();
}
