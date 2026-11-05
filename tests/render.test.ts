import { describe, it, expect, vi } from "vitest";
import { registerRenderTools } from "../src/tools/render";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HimalayaClient } from "../src/himalaya/client.js";

describe("render_email", () => {
  it("registers the tool", () => {
    const server = { registerTool: vi.fn() };
    const client = new HimalayaClient({ from: "test@example.com" });
    registerRenderTools(server as unknown as McpServer, client);
    expect(server.registerTool).toHaveBeenCalledWith(
      "render_email",
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("converts HTML to markdown when HTML body is available", async () => {
    const server = { registerTool: vi.fn() };
    const client = new HimalayaClient({ from: "test@example.com" });
    vi.spyOn(client, "readMessageHtml").mockResolvedValue("<p>Hello <strong>world</strong></p>");
    registerRenderTools(server as unknown as McpServer, client);

    const handler = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][2];
    const result = await handler({ id: "123", folder: undefined, account: undefined });

    expect(result.content[0].type).toBe("text");
    expect(result.isError).toBeUndefined();
  });

  it("falls back to plain text when HTML parsing fails", async () => {
    const server = { registerTool: vi.fn() };
    const client = new HimalayaClient({ from: "test@example.com" });
    vi.spyOn(client, "readMessageHtml").mockResolvedValue("");
    vi.spyOn(client, "readMessage").mockResolvedValue("Plain text email body");
    registerRenderTools(server as unknown as McpServer, client);

    const handler = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][2];
    const result = await handler({ id: "123", folder: undefined, account: undefined });

    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("Plain text email body");
  });

  it("passes folder and account to client methods", async () => {
    const server = { registerTool: vi.fn() };
    const client = new HimalayaClient({ from: "test@example.com" });
    vi.spyOn(client, "readMessageHtml").mockResolvedValue("");
    vi.spyOn(client, "readMessage").mockResolvedValue("Body");
    registerRenderTools(server as unknown as McpServer, client);

    const handler = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][2];
    await handler({ id: "123", folder: "Archive", account: "work" });

    expect(client.readMessageHtml).toHaveBeenCalledWith("123", "Archive", "work");
    expect(client.readMessage).toHaveBeenCalledWith("123", "Archive", "work");
  });

  it("returns isError when readMessageHtml and readMessage both fail", async () => {
    const server = { registerTool: vi.fn() };
    const client = new HimalayaClient({ from: "test@example.com" });
    vi.spyOn(client, "readMessageHtml").mockRejectedValue(new Error("Failed"));
    vi.spyOn(client, "readMessage").mockRejectedValue(new Error("Failed too"));
    registerRenderTools(server as unknown as McpServer, client);

    const handler = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][2];
    const result = await handler({ id: "123", folder: undefined, account: undefined });

    expect(result.isError).toBe(true);
  });

  it("falls back to plain text when readMessageHtml throws (#145: ENOENT on index.html)", async () => {
    const server = { registerTool: vi.fn() };
    const client = new HimalayaClient({ from: "test@example.com" });
    vi.spyOn(client, "readMessageHtml").mockRejectedValue(
      new Error("ENOENT: no such file or directory, open '/tmp/himalaya-mcp-html-x/index.html'"),
    );
    vi.spyOn(client, "readMessage").mockResolvedValue('"Plain text email body"');
    registerRenderTools(server as unknown as McpServer, client);

    const handler = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][2];
    const result = await handler({ id: "123", folder: undefined, account: undefined });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe("Plain text email body");
  });

  it("returns a string for a himalaya v2 object body in the plain-text fallback (#144)", async () => {
    const server = { registerTool: vi.fn() };
    const client = new HimalayaClient({ from: "test@example.com" });
    vi.spyOn(client, "readMessageHtml").mockResolvedValue("");
    vi.spyOn(client, "readMessage").mockResolvedValue(
      JSON.stringify({ html_body: [0], text_body: [0], attachments: [], parts: [{ body: { Text: "v2 body" } }] }),
    );
    registerRenderTools(server as unknown as McpServer, client);

    const handler = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][2];
    const result = await handler({ id: "123", folder: undefined, account: undefined });

    expect(result.content[0].text).toBe("v2 body");
  });
});
