import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerClipboardTools } from "../src/adapters/clipboard.js";

// Mock child_process for clipboard
vi.mock("node:child_process", async () => {
  const { promisify: realPromisify } = await import("node:util");
  const { Writable } = await import("node:stream");

  const fn: any = vi.fn();
  const promisified = vi.fn().mockImplementation(() => {
    const stdin = new Writable({
      write(_chunk, _encoding, callback) { callback(); },
    });
    const promise = Promise.resolve({ stdout: "", stderr: "" }) as any;
    promise.child = { stdin };
    return promise;
  });
  fn[realPromisify.custom] = promisified;
  return { execFile: fn };
});

function getToolHandler(server: McpServer, toolName: string) {
  const tools = (server as any)._registeredTools as Record<string, any>;
  const tool = tools?.[toolName];
  if (!tool) throw new Error(`Tool "${toolName}" not registered`);
  return tool;
}

describe("Clipboard adapter", () => {
  let server: McpServer;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new McpServer({ name: "test", version: "0.0.1" });
    registerClipboardTools(server);
  });

  it("registers copy_to_clipboard tool", () => {
    const tools = (server as any)._registeredTools;
    expect(tools).toHaveProperty("copy_to_clipboard");
  });

  it("returns success with char count", async () => {
    const tool = getToolHandler(server, "copy_to_clipboard");
    const result = await tool.handler({ text: "Hello, world!" }, {} as any);

    expect(result.content[0].text).toContain("Copied to clipboard");
    expect(result.content[0].text).toContain("13 chars");
  });

  it("truncates long preview", async () => {
    const tool = getToolHandler(server, "copy_to_clipboard");
    const longText = "A".repeat(200);
    const result = await tool.handler({ text: longText }, {} as any);

    expect(result.content[0].text).toContain("200 chars");
    expect(result.content[0].text).toContain("...");
  });

  it("shows short text in full", async () => {
    const tool = getToolHandler(server, "copy_to_clipboard");
    const result = await tool.handler({ text: "Short text" }, {} as any);

    expect(result.content[0].text).toContain("Short text");
    expect(result.content[0].text).not.toContain("...");
  });
});
