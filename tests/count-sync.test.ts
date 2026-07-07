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
 */

import { describe, it, expect } from "vitest";
import { TOOL_COUNT } from "../src/index";

describe("tool count sync", () => {
  it("TOOL_COUNT matches expected tool count", () => {
    // When adding/removing tools, update this number AND update:
    //   - TOOL_COUNT in src/index.ts
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
    expect(TOOL_COUNT).toBe(26);
  });
});
