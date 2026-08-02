/**
 * Count-sync test.
 *
 * Asserts that the exported TOOL_COUNT constant matches the expected
 * tool count. When tools are added or removed, this constant must be
 * updated — and any doc referencing tool count will likewise need
 * updating. This prevents silent drift.
 *
 * The actual registration-vs-declaration check is in the E2E test
 * (e2e.test.ts "lists all N registered tools") which queries the
 * live MCP server. This test ensures the constant is correct.
 *
 * It also parses docs/reference/cheat-sheet.md's tool list and
 * docs/guide/packaging.md's marketplace.json example directly, so a
 * hand-maintained doc going stale (missing a tool, wrong plugin name)
 * fails CI instead of surviving until the next manual audit.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TOOL_COUNT } from "../src/index";

const REPO_ROOT = join(__dirname, "..");

// Canonical tool list — kept in sync with e2e.test.ts's live MCP server check
// ("lists all N registered tools"). Update both when tools are added/removed.
const CANONICAL_TOOLS = [
  "compose_email",
  "copy_to_clipboard",
  "create_action_item",
  "create_calendar_event",
  "create_folder",
  "create_reminder",
  "delete_folder",
  "download_attachment",
  "draft_reply",
  "export_to_markdown",
  "extract_calendar_event",
  "flag_email",
  "get_unread_count",
  "health_check",
  "list_attachments",
  "list_emails",
  "list_folders",
  "list_snoozed_emails",
  "list_starred",
  "list_threads",
  "move_email",
  "read_email",
  "read_email_html",
  "read_email_raw",
  "read_thread",
  "render_email",
  "search_emails",
  "send_email",
  "snooze_email",
].sort();

describe("tool count sync", () => {
  it("TOOL_COUNT matches expected tool count", () => {
    // When adding/removing tools, update this number AND update:
    //   - TOOL_COUNT in src/index.ts
    //   - CANONICAL_TOOLS in this file
    //   - e2e.test.ts tool list
    //   - dogfood.test.ts manifest tool list and count
    //   - v150-features.test.ts description check
    //   - mcpb/manifest.json tools array
    //   - plugin.json description
    //   - help/SKILL.md tool count
    //   - CLAUDE.md tool tables and counts
    //   - docs/reference/commands.md
    //   - docs/reference/cheat-sheet.md
    //   - docs/index.md grid cards
    expect(TOOL_COUNT).toBe(29);
    expect(CANONICAL_TOOLS.length).toBe(TOOL_COUNT);
  });

  it("docs/reference/cheat-sheet.md's tool list matches the canonical set", () => {
    const cheatSheet = readFileSync(
      join(REPO_ROOT, "docs/reference/cheat-sheet.md"),
      "utf-8",
    );

    const headingMatch = cheatSheet.match(/## MCP Tools \((\d+)\)/);
    expect(headingMatch, "cheat-sheet.md must have a '## MCP Tools (N)' heading").toBeTruthy();
    const headingCount = Number(headingMatch![1]);

    // Extract the fenced code block right after the heading.
    const blockMatch = cheatSheet.match(/## MCP Tools \(\d+\)\s*\n\s*```\n([\s\S]*?)```/);
    expect(blockMatch, "cheat-sheet.md must have a fenced tool list under the heading").toBeTruthy();

    const listedTools = blockMatch![1]
      .split("\n")
      .map((line) => line.trim().split(/\s+/)[0])
      .filter(Boolean)
      .sort();

    expect(headingCount, "heading count must match TOOL_COUNT").toBe(TOOL_COUNT);
    expect(listedTools, "listed tools must match the canonical set exactly").toEqual(CANONICAL_TOOLS);
  });

  it("docs/guide/packaging.md's marketplace.json example matches the real plugin name", () => {
    const marketplace = JSON.parse(
      readFileSync(join(REPO_ROOT, ".claude-plugin/marketplace.json"), "utf-8"),
    ) as { plugins: Array<{ name: string }> };
    const realPluginName = marketplace.plugins[0].name;

    const packaging = readFileSync(join(REPO_ROOT, "docs/guide/packaging.md"), "utf-8");
    const exampleMatch = packaging.match(/```json\n\{[\s\S]*?"plugins":\s*\[\{([\s\S]*?)\}\][\s\S]*?```/);
    expect(exampleMatch, "packaging.md must have a marketplace.json example with a plugins array").toBeTruthy();

    const nameMatch = exampleMatch![1].match(/"name":\s*"([^"]+)"/);
    expect(nameMatch, "packaging.md example must declare a plugin name").toBeTruthy();
    expect(nameMatch![1]).toBe(realPluginName);
  });
});
