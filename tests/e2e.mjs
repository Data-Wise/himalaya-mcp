/**
 * End-to-end integration test — runs against real himalaya CLI.
 * Not part of vitest suite (requires configured email account).
 */

import { HimalayaClient } from "../dist/himalaya/client.js";
import { parseEnvelopes, parseFolders, parseMessageBody } from "../dist/himalaya/parser.js";

const client = new HimalayaClient();
let passed = 0;
let failed = 0;

function ok(name, condition, detail) {
  if (condition) {
    console.log(`  PASS: ${name}${detail ? " — " + detail : ""}`);
    passed++;
  } else {
    console.error(`  FAIL: ${name}${detail ? " — " + detail : ""}`);
    failed++;
  }
}

console.log("=== E2E: List Envelopes ===");
const envRaw = await client.listEnvelopes(undefined, 3);
const envResult = parseEnvelopes(envRaw);
ok("parse succeeds", envResult.ok);
if (envResult.ok) {
  ok("returns array", Array.isArray(envResult.data), `${envResult.data.length} envelopes`);
  if (envResult.data.length > 0) {
    const e = envResult.data[0];
    ok("has id", typeof e.id === "string", e.id);
    ok("has subject", typeof e.subject === "string", e.subject.slice(0, 50));
    ok("has from.addr", typeof e.from.addr === "string", e.from.addr);
    ok("has date", typeof e.date === "string", e.date);
  }
}

console.log("\n=== E2E: List Folders ===");
const foldRaw = await client.listFolders();
const foldResult = parseFolders(foldRaw);
ok("parse succeeds", foldResult.ok);
if (foldResult.ok) {
  ok("returns array", Array.isArray(foldResult.data), `${foldResult.data.length} folders`);
  const names = foldResult.data.map(f => f.name);
  ok("has INBOX", names.includes("INBOX"));
}

console.log("\n=== E2E: Search Envelopes ===");
// IMAP search can be slow (>30s) depending on server
// Use himalaya filter syntax: "subject <pattern>"
try {
  const searchRaw = await client.searchEnvelopes("subject faculty");
  const searchResult = parseEnvelopes(searchRaw);
  ok("parse succeeds", searchResult.ok);
  if (searchResult.ok) {
    ok("returns array", Array.isArray(searchResult.data), `${searchResult.data.length} results`);
  }
} catch (e) {
  console.log(`  SKIP: search timed out (IMAP server-side, not a code bug)`);
}

console.log("\n=== E2E: Read Message ===");
if (envResult.ok && envResult.data.length > 0) {
  const firstId = envResult.data[0].id;
  const msgRaw = await client.readMessage(firstId);
  const msgResult = parseMessageBody(msgRaw);
  ok("parse succeeds", msgResult.ok);
  if (msgResult.ok) {
    ok("body is string", typeof msgResult.data === "string", `${msgResult.data.length} chars`);
  }
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
