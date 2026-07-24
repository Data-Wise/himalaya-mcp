import { describe, it, expect, vi } from "vitest";
import { registerUnreadTools } from "../src/tools/unread";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

describe("get_unread_count", () => {
  it("returns the count of unread envelopes", async () => {
    const envelopes = [{ id: "1" }, { id: "2" }, { id: "3" }];
    const client = {
      searchEnvelopes: vi.fn().mockResolvedValue(JSON.stringify(envelopes)),
    };

    const server = { registerTool: vi.fn() };
    registerUnreadTools(server as unknown as McpServer, client as any);
    const handler = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][2];
    const result = await handler({});

    expect(client.searchEnvelopes).toHaveBeenCalledWith("not flag Seen", undefined, undefined);
    expect(result.content[0].text).toBe("3");
  });

  it("passes folder and account to the client", async () => {
    const envelopes = [{ id: "1" }];
    const client = {
      searchEnvelopes: vi.fn().mockResolvedValue(JSON.stringify(envelopes)),
    };

    const server = { registerTool: vi.fn() };
    registerUnreadTools(server as unknown as McpServer, client as any);
    const handler = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][2];
    await handler({ folder: "Sent", account: "work" });

    expect(client.searchEnvelopes).toHaveBeenCalledWith("not flag Seen", "Sent", "work");
  });

  it("returns 0 when the inbox is fully read", async () => {
    const client = {
      searchEnvelopes: vi.fn().mockResolvedValue("[]"),
    };

    const server = { registerTool: vi.fn() };
    registerUnreadTools(server as unknown as McpServer, client as any);
    const handler = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][2];
    const result = await handler({});

    expect(result.content[0].text).toBe("0");
  });

  it("handles errors via envelopeError", async () => {
    const client = {
      searchEnvelopes: vi.fn().mockRejectedValue(new Error("himalaya error")),
    };

    const server = { registerTool: vi.fn() };
    registerUnreadTools(server as unknown as McpServer, client as any);
    const handler = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][2];
    const result = await handler({});

    expect(result.isError).toBe(true);
  });
});
