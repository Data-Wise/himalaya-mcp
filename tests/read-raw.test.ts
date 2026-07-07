import { describe, it, expect, vi } from "vitest";
import { registerReadRawTools } from "../src/tools/read-raw";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HimalayaClient } from "../src/himalaya/client.js";

describe("read_email_raw", () => {
  it("registers the tool", () => {
    const server = { registerTool: vi.fn() };
    const client = new HimalayaClient({ from: "test@example.com" });
    registerReadRawTools(server as unknown as McpServer, client);
    expect(server.registerTool).toHaveBeenCalledWith(
      "read_email_raw",
      expect.objectContaining({
        description: expect.stringContaining("raw MIME source"),
      }),
      expect.any(Function),
    );
  });

  it("tool description mentions .eml export format", () => {
    const server = { registerTool: vi.fn() };
    const client = new HimalayaClient({ from: "test@example.com" });
    registerReadRawTools(server as unknown as McpServer, client);
    const call = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0];
    const description = (call[1] as any).description;
    expect(description).toContain("eml");
  });

  it("handler is a function", () => {
    const server = { registerTool: vi.fn() };
    const client = new HimalayaClient({ from: "test@example.com" });
    registerReadRawTools(server as unknown as McpServer, client);
    const handler = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][2];
    expect(typeof handler).toBe("function");
  });

  it("inputSchema has id, folder, and account parameters", () => {
    const server = { registerTool: vi.fn() };
    const client = new HimalayaClient({ from: "test@example.com" });
    registerReadRawTools(server as unknown as McpServer, client);
    const inputSchema = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][1].inputSchema;
    expect(inputSchema.id).toBeDefined();
    expect(inputSchema.folder).toBeDefined();
    expect(inputSchema.account).toBeDefined();
  });
});
