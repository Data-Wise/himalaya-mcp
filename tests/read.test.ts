import { describe, it, expect, vi } from "vitest";
import { registerReadTools } from "../src/tools/read";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HimalayaClient } from "../src/himalaya/client.js";

type Handler = (args: { id: string; folder?: string; account?: string }) => Promise<{
  content: Array<{ type: string; text: unknown }>;
  isError?: boolean;
}>;

function getHandler(name: string, client: HimalayaClient): Handler {
  const server = { registerTool: vi.fn() };
  registerReadTools(server as unknown as McpServer, client);
  const call = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls.find((c) => c[0] === name);
  return call![2] as Handler;
}

// himalaya v2.2.1 `message read --json` shape (#144)
const V2_MESSAGE = JSON.stringify({
  html_body: [2],
  text_body: [1],
  attachments: [],
  parts: [
    { headers: [], body: { Multipart: [1, 2] } },
    { headers: [], body: { Text: "plain body" } },
    { headers: [], body: { Html: "<p>html body</p>" } },
  ],
});

describe("read_email", () => {
  it("returns text content as a string for a himalaya v2 object payload (#144)", async () => {
    const client = new HimalayaClient({ from: "test@example.com" });
    vi.spyOn(client, "readMessage").mockResolvedValue(V2_MESSAGE);

    const result = await getHandler("read_email", client)({ id: "1" });

    expect(result.content[0].type).toBe("text");
    expect(typeof result.content[0].text).toBe("string");
    expect(result.content[0].text).toBe("plain body");
  });

  it("still returns the body for a himalaya v1 quoted-string payload", async () => {
    const client = new HimalayaClient({ from: "test@example.com" });
    vi.spyOn(client, "readMessage").mockResolvedValue('"Hello\\n\\nbody"');

    const result = await getHandler("read_email", client)({ id: "1" });

    expect(result.content[0].text).toBe("Hello\n\nbody");
  });
});

describe("read_email_html", () => {
  it("returns the html string", async () => {
    const client = new HimalayaClient({ from: "test@example.com" });
    vi.spyOn(client, "readMessageHtml").mockResolvedValue("<p>html body</p>");

    const result = await getHandler("read_email_html", client)({ id: "1" });

    expect(typeof result.content[0].text).toBe("string");
    expect(result.content[0].text).toBe("<p>html body</p>");
  });
});
