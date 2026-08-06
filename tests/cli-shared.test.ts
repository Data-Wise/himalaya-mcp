import { describe, expect, it } from "vitest";
import { stableBrewEntry } from "../src/cli/shared";

describe("stableBrewEntry", () => {
  it("maps a versioned Homebrew Cellar path to the stable opt path", () => {
    expect(
      stableBrewEntry("/opt/homebrew/Cellar/himalaya-mcp/2.0.4/libexec/dist/cli/index.js"),
    ).toBe("/opt/homebrew/opt/himalaya-mcp/libexec/dist/index.js");
  });

  it("keeps a stable Homebrew opt invocation stable", () => {
    expect(
      stableBrewEntry("/opt/homebrew/opt/himalaya-mcp/libexec/dist/cli/index.js"),
    ).toBe("/opt/homebrew/opt/himalaya-mcp/libexec/dist/index.js");
  });

  it("returns null for source-checkout paths", () => {
    expect(stableBrewEntry("/work/himalaya-mcp/dist/cli/index.js")).toBeNull();
  });
});
