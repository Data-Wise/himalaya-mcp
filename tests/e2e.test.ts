/**
 * Headless E2E tests — verify the full MCP server pipeline.
 *
 * Spawns the actual MCP server as a subprocess and communicates via
 * JSON-RPC over stdin/stdout. Tests: initialization, tool listing,
 * prompt listing, and tool invocation.
 *
 * himalaya CLI is mocked via PATH override to avoid needing real email.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, mkdir, chmod, rm } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "..");

// --- Fake himalaya binary for E2E tests ---

const FAKE_RESPONSES: Record<string, string> = {
  "envelope list": JSON.stringify([
    {
      id: "100",
      flags: ["Seen"],
      subject: "E2E Test Email",
      from: { name: "Test Sender", addr: "test@example.com" },
      to: { name: null, addr: "me@example.com" },
      date: "2026-02-13 10:00",
      has_attachment: false,
    },
  ]),
  "message read": JSON.stringify("This is the E2E test email body."),
  "folder list": JSON.stringify([
    { name: "INBOX", desc: "" },
    { name: "Sent", desc: "" },
    { name: "Archive", desc: "" },
  ]),
  "flag add": "{}",
  "flag remove": "{}",
  "message move": "{}",
  "template reply": JSON.stringify(
    "From: me@example.com\nTo: test@example.com\nSubject: Re: E2E Test Email\n\nReply body\n\n> This is the E2E test email body."
  ),
  "template send": "{}",
};

let fakeBinDir: string;
let serverProcess: ReturnType<typeof spawn>;
let responseBuffer = "";
let pendingResolvers: Map<number, (value: any) => void> = new Map();
let requestId = 0;

/** Create a fake himalaya binary that returns canned JSON responses. */
async function createFakeHimalaya(dir: string) {
  const script = `#!/bin/bash
# Fake himalaya for E2E tests — returns canned JSON based on subcommand
args="$*"

# Strip global flags to match subcommand
clean=$(echo "$args" | sed 's/--account [^ ]* //g' | sed 's/--output json //g')

if echo "$clean" | grep -q "envelope list"; then
  echo '${FAKE_RESPONSES["envelope list"].replace(/'/g, "'\"'\"'")}'
elif echo "$clean" | grep -q "message read"; then
  echo '${FAKE_RESPONSES["message read"].replace(/'/g, "'\"'\"'")}'
elif echo "$clean" | grep -q "folder list"; then
  echo '${FAKE_RESPONSES["folder list"].replace(/'/g, "'\"'\"'")}'
elif echo "$clean" | grep -q "flag add"; then
  echo '{}'
elif echo "$clean" | grep -q "flag remove"; then
  echo '{}'
elif echo "$clean" | grep -q "message move"; then
  echo '{}'
elif echo "$clean" | grep -q "template reply"; then
  echo '${FAKE_RESPONSES["template reply"].replace(/'/g, "'\"'\"'")}'
elif echo "$clean" | grep -q "template send"; then
  echo '{}'
elif echo "$clean" | grep -q "folder create"; then
  echo '{}'
elif echo "$clean" | grep -q "folder delete"; then
  echo '{}'
elif echo "$clean" | grep -q "attachment download"; then
  # Create fake attachment files in cwd (our tools do readdir+stat on real files)
  echo "fake pdf content for e2e testing" > "$PWD/report.pdf"
  cat > "$PWD/invite.ics" << 'ICSEOF'
BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:E2E Test Meeting
DTSTART:20260301T140000
DTEND:20260301T150000
LOCATION:Room 42
ORGANIZER;CN=Alice:mailto:alice@test.com
DESCRIPTION:E2E test calendar event
UID:e2e-test-uid@example.com
END:VEVENT
END:VCALENDAR
ICSEOF
  echo "body text" > "$PWD/plain.txt"
  echo "<html>body</html>" > "$PWD/index.html"
  echo '{}'
else
  echo '[]'
fi
`;
  const binPath = join(dir, "himalaya");
  await writeFile(binPath, script);
  await chmod(binPath, 0o755);
  return dir;
}

/** Send a JSON-RPC request to the server and wait for the response. */
function sendRequest(method: string, params?: any): Promise<any> {
  const id = ++requestId;
  const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params: params || {} });
  serverProcess.stdin!.write(msg + "\n");

  return new Promise((resolve) => {
    pendingResolvers.set(id, resolve);
  });
}

/** Send a JSON-RPC notification (no response expected). */
function sendNotification(method: string, params?: any) {
  const msg = JSON.stringify({ jsonrpc: "2.0", method, params: params || {} });
  serverProcess.stdin!.write(msg + "\n");
}

describe("E2E: MCP Server Headless", () => {
  beforeAll(async () => {
    // Build first
    await execFileAsync("npm", ["run", "build"], {
      cwd: PROJECT_ROOT,
    });

    // Create fake himalaya
    fakeBinDir = join(tmpdir(), `himalaya-e2e-${Date.now()}`);
    await mkdir(fakeBinDir, { recursive: true });
    await createFakeHimalaya(fakeBinDir);

    // Spawn MCP server with fake himalaya in PATH
    serverProcess = spawn("node", ["dist/index.js"], {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        PATH: `${fakeBinDir}:${process.env.PATH}`,
        HIMALAYA_BINARY: join(fakeBinDir, "himalaya"),
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Parse JSON-RPC responses from stdout
    serverProcess.stdout!.on("data", (chunk) => {
      responseBuffer += chunk.toString();
      // Try to parse complete JSON-RPC messages
      const lines = responseBuffer.split("\n");
      responseBuffer = lines.pop() || ""; // Keep incomplete last line
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id && pendingResolvers.has(msg.id)) {
            pendingResolvers.get(msg.id)!(msg);
            pendingResolvers.delete(msg.id);
          }
        } catch {
          // Not JSON, skip
        }
      }
    });

    // Initialize MCP handshake
    const initResult = await sendRequest("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "e2e-test", version: "1.0.0" },
    });

    expect(initResult.result).toBeDefined();
    expect(initResult.result.serverInfo.name).toBe("himalaya-mcp");
    expect(initResult.result.serverInfo.version).toBe("1.2.2");

    // Send initialized notification
    sendNotification("notifications/initialized");
  }, 15_000);

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill("SIGTERM");
    }
    if (fakeBinDir) {
      await rm(fakeBinDir, { recursive: true, force: true });
    }
  });

  // --- Tool listing ---

  it("lists all 19 registered tools", async () => {
    const result = await sendRequest("tools/list");
    const tools = result.result.tools;
    const toolNames = tools.map((t: any) => t.name).sort();

    expect(toolNames).toEqual([
      "compose_email",
      "copy_to_clipboard",
      "create_action_item",
      "create_calendar_event",
      "create_folder",
      "delete_folder",
      "download_attachment",
      "draft_reply",
      "export_to_markdown",
      "extract_calendar_event",
      "flag_email",
      "list_attachments",
      "list_emails",
      "list_folders",
      "move_email",
      "read_email",
      "read_email_html",
      "search_emails",
      "send_email",
    ]);
  });

  it("each tool has a description and inputSchema", async () => {
    const result = await sendRequest("tools/list");
    for (const tool of result.result.tools) {
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
    }
  });

  // --- Prompt listing ---

  it("lists all 4 registered prompts", async () => {
    const result = await sendRequest("prompts/list");
    const prompts = result.result.prompts;
    const promptNames = prompts.map((p: any) => p.name).sort();

    expect(promptNames).toEqual([
      "daily_email_digest",
      "draft_reply",
      "summarize_email",
      "triage_inbox",
    ]);
  });

  it("each prompt has a description", async () => {
    const result = await sendRequest("prompts/list");
    for (const prompt of result.result.prompts) {
      expect(prompt.description).toBeTruthy();
    }
  });

  // --- Resource listing ---

  it("lists registered resources", async () => {
    const result = await sendRequest("resources/list");
    const resources = result.result.resources;

    expect(resources.length).toBeGreaterThanOrEqual(2);
    const uris = resources.map((r: any) => r.uri);
    expect(uris).toContain("email://inbox");
    expect(uris).toContain("email://folders");
  });

  // --- Tool invocation ---

  it("list_emails returns envelope data", async () => {
    const result = await sendRequest("tools/call", {
      name: "list_emails",
      arguments: {},
    });

    const text = result.result.content[0].text;
    expect(text).toContain("1 emails");
    expect(text).toContain("E2E Test Email");
    expect(text).toContain("Test Sender");
    expect(text).toContain("100");
  });

  it("read_email returns message body", async () => {
    const result = await sendRequest("tools/call", {
      name: "read_email",
      arguments: { id: "100" },
    });

    const text = result.result.content[0].text;
    expect(text).toContain("E2E test email body");
  });

  it("flag_email succeeds", async () => {
    const result = await sendRequest("tools/call", {
      name: "flag_email",
      arguments: { id: "100", flags: ["Flagged"], action: "add" },
    });

    const text = result.result.content[0].text;
    expect(text).toContain("Added");
    expect(text).toContain("Flagged");
  });

  it("move_email succeeds", async () => {
    const result = await sendRequest("tools/call", {
      name: "move_email",
      arguments: { id: "100", target_folder: "Archive" },
    });

    const text = result.result.content[0].text;
    expect(text).toContain("Moved");
    expect(text).toContain("Archive");
  });

  it("draft_reply returns template with DRAFT markers", async () => {
    const result = await sendRequest("tools/call", {
      name: "draft_reply",
      arguments: { id: "100" },
    });

    const text = result.result.content[0].text;
    expect(text).toContain("DRAFT");
    expect(text).toContain("Re: E2E Test Email");
  });

  it("send_email without confirm returns preview", async () => {
    const result = await sendRequest("tools/call", {
      name: "send_email",
      arguments: { template: "From: me@test.com\nSubject: Test\n\nHello" },
    });

    const text = result.result.content[0].text;
    expect(text).toContain("PREVIEW");
    expect(text).toContain("NOT been sent");
  });

  it("send_email with confirm=true sends", async () => {
    const result = await sendRequest("tools/call", {
      name: "send_email",
      arguments: {
        template: "From: me@test.com\nTo: you@test.com\nSubject: Test\n\nHello",
        confirm: true,
      },
    });

    const text = result.result.content[0].text;
    expect(text).toContain("sent successfully");
  });

  it("export_to_markdown returns formatted markdown", async () => {
    const result = await sendRequest("tools/call", {
      name: "export_to_markdown",
      arguments: { id: "100" },
    });

    const text = result.result.content[0].text;
    expect(text).toContain("---");
    expect(text).toContain("subject:");
    expect(text).toContain("# E2E Test Email");
    expect(text).toContain("E2E test email body");
  });

  it("create_action_item returns structured context", async () => {
    const result = await sendRequest("tools/call", {
      name: "create_action_item",
      arguments: { id: "100" },
    });

    const text = result.result.content[0].text;
    expect(text).toContain("E2E Test Email");
    expect(text).toContain("Action items");
  });

  // --- Prompt invocation ---

  it("triage_inbox prompt returns guide text", async () => {
    const result = await sendRequest("prompts/get", {
      name: "triage_inbox",
      arguments: {},
    });

    const text = result.result.messages[0].content.text;
    expect(text).toContain("list_emails");
    expect(text).toContain("Actionable");
  });

  it("summarize_email prompt includes email ID", async () => {
    const result = await sendRequest("prompts/get", {
      name: "summarize_email",
      arguments: { id: "100" },
    });

    const text = result.result.messages[0].content.text;
    expect(text).toContain("100");
    expect(text).toContain("read_email");
  });

  it("daily_email_digest prompt returns guide text", async () => {
    const result = await sendRequest("prompts/get", {
      name: "daily_email_digest",
      arguments: {},
    });

    const text = result.result.messages[0].content.text;
    expect(text).toContain("priority");
    expect(text).toContain("list_emails");
  });

  it("draft_reply prompt includes safety warning", async () => {
    const result = await sendRequest("prompts/get", {
      name: "draft_reply",
      arguments: { id: "100" },
    });

    const text = result.result.messages[0].content.text;
    expect(text).toContain("100");
    expect(text).toContain("approval");
  });

  // --- Resource reads ---

  it("email://inbox resource returns inbox listing", async () => {
    const result = await sendRequest("resources/read", {
      uri: "email://inbox",
    });

    const text = result.result.contents[0].text;
    expect(text).toContain("E2E Test Email");
    expect(text).toContain("100");
  });

  it("email://folders resource returns folder list", async () => {
    const result = await sendRequest("resources/read", {
      uri: "email://folders",
    });

    const text = result.result.contents[0].text;
    expect(text).toContain("INBOX");
    expect(text).toContain("Sent");
    expect(text).toContain("Archive");
  });

  // --- Folder tools ---

  it("list_folders returns folder list", async () => {
    const result = await sendRequest("tools/call", {
      name: "list_folders",
      arguments: {},
    });

    const text = result.result.content[0].text;
    expect(text).toContain("INBOX");
    expect(text).toContain("Sent");
    expect(text).toContain("Archive");
  });

  it("create_folder succeeds", async () => {
    const result = await sendRequest("tools/call", {
      name: "create_folder",
      arguments: { name: "Projects" },
    });

    const text = result.result.content[0].text;
    expect(text).toContain("Projects");
    expect(text).toContain("created");
  });

  it("delete_folder without confirm returns preview", async () => {
    const result = await sendRequest("tools/call", {
      name: "delete_folder",
      arguments: { name: "OldStuff" },
    });

    const text = result.result.content[0].text;
    expect(text).toContain("PREVIEW");
    expect(text).toContain("NOT been deleted");
    expect(text).toContain("OldStuff");
  });

  // --- Compose ---

  it("compose_email without confirm returns preview", async () => {
    const result = await sendRequest("tools/call", {
      name: "compose_email",
      arguments: {
        to: "bob@example.com",
        subject: "Hello from E2E",
        body: "This is an E2E compose test.",
      },
    });

    const text = result.result.content[0].text;
    expect(text).toContain("PREVIEW");
    expect(text).toContain("NOT been sent");
    expect(text).toContain("bob@example.com");
    expect(text).toContain("Hello from E2E");
  });

  it("compose_email with confirm=true sends", async () => {
    const result = await sendRequest("tools/call", {
      name: "compose_email",
      arguments: {
        to: "bob@example.com",
        subject: "Hello from E2E",
        body: "This is an E2E compose test.",
        confirm: true,
      },
    });

    const text = result.result.content[0].text;
    expect(text).toContain("sent successfully");
    expect(text).toContain("bob@example.com");
  });

  // --- Attachment tools ---

  it("list_attachments returns files with sizes (filters body parts)", async () => {
    const result = await sendRequest("tools/call", {
      name: "list_attachments",
      arguments: { id: "100" },
    });

    const text = result.result.content[0].text;
    expect(text).toContain("report.pdf");
    expect(text).toContain("invite.ics");
    // Body parts should be filtered out
    expect(text).not.toContain("plain.txt");
    expect(text).not.toContain("index.html");
  });

  it("list_attachments shows MIME types inferred from extension", async () => {
    const result = await sendRequest("tools/call", {
      name: "list_attachments",
      arguments: { id: "100" },
    });

    const text = result.result.content[0].text;
    expect(text).toContain("application/pdf");
    expect(text).toContain("text/calendar");
  });

  it("download_attachment returns file path", async () => {
    const result = await sendRequest("tools/call", {
      name: "download_attachment",
      arguments: { id: "100", filename: "report.pdf" },
    });

    const text = result.result.content[0].text;
    expect(text).toContain("report.pdf");
    expect(text).toContain("Downloaded");
  });

  // --- Calendar tools ---

  it("extract_calendar_event parses ICS from downloaded attachments", async () => {
    const result = await sendRequest("tools/call", {
      name: "extract_calendar_event",
      arguments: { id: "100" },
    });

    const text = result.result.content[0].text;
    expect(text).toContain("E2E Test Meeting");
    expect(text).toContain("Room 42");
    expect(text).toContain("alice@test.com");
  });

  it("create_calendar_event without confirm returns preview", async () => {
    const result = await sendRequest("tools/call", {
      name: "create_calendar_event",
      arguments: {
        summary: "E2E Meeting",
        dtstart: "2026-03-01T14:00:00",
        dtend: "2026-03-01T15:00:00",
        location: "Room 42",
      },
    });

    const text = result.result.content[0].text;
    expect(text).toContain("PREVIEW");
    expect(text).toContain("NOT been created");
    expect(text).toContain("E2E Meeting");
    expect(text).toContain("Room 42");
  });

  // --- Error path tests ---

  describe("E2E: Error Paths", () => {
    it(
      "server handles missing himalaya binary gracefully",
      async () => {
        let errorServerProcess: ReturnType<typeof spawn> | null = null;
        let errorResponseBuffer = "";
        const errorPendingResolvers: Map<number, (value: any) => void> =
          new Map();
        let errorRequestId = 0;

        try {
          // Spawn a separate server with nonexistent himalaya binary
          errorServerProcess = spawn("node", ["dist/index.js"], {
            cwd: PROJECT_ROOT,
            env: {
              ...process.env,
              HIMALAYA_BINARY: `/tmp/nonexistent-himalaya-${Date.now()}`,
            },
            stdio: ["pipe", "pipe", "pipe"],
          });

          // Create a separate sendRequest for this server
          function sendErrorRequest(method: string, params?: any): Promise<any> {
            const id = ++errorRequestId;
            const msg = JSON.stringify({
              jsonrpc: "2.0",
              id,
              method,
              params: params || {},
            });
            errorServerProcess!.stdin!.write(msg + "\n");

            return new Promise((resolve) => {
              errorPendingResolvers.set(id, resolve);
            });
          }

          // Parse responses
          errorServerProcess.stdout!.on("data", (chunk) => {
            errorResponseBuffer += chunk.toString();
            const lines = errorResponseBuffer.split("\n");
            errorResponseBuffer = lines.pop() || "";
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const msg = JSON.parse(line);
                if (msg.id && errorPendingResolvers.has(msg.id)) {
                  errorPendingResolvers.get(msg.id)!(msg);
                  errorPendingResolvers.delete(msg.id);
                }
              } catch {
                // Not JSON, skip
              }
            }
          });

          // Initialize
          const initResult = await sendErrorRequest("initialize", {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: { name: "error-test", version: "1.0.0" },
          });

          expect(initResult.result).toBeDefined();

          // Try to call list_emails with missing binary
          const listResult = await sendErrorRequest("tools/call", {
            name: "list_emails",
            arguments: {},
          });

          // Expect error in the response
          const hasError =
            listResult.error ||
            listResult.result?.isError ||
            (listResult.result?.content?.[0]?.text &&
              (listResult.result.content[0].text.includes("error") ||
                listResult.result.content[0].text.includes("Error") ||
                listResult.result.content[0].text.includes("ENOENT") ||
                listResult.result.content[0].text.includes("not found")));

          expect(hasError).toBeTruthy();
        } finally {
          if (errorServerProcess) {
            errorServerProcess.kill("SIGTERM");
          }
        }
      },
      10_000
    );

    it(
      "server handles himalaya returning invalid JSON",
      async () => {
        let invalidJsonServerProcess: ReturnType<typeof spawn> | null = null;
        let invalidJsonResponseBuffer = "";
        const invalidJsonPendingResolvers: Map<number, (value: any) => void> =
          new Map();
        let invalidJsonRequestId = 0;

        // Create fake binary that returns invalid JSON
        const invalidJsonBinDir = join(
          tmpdir(),
          `himalaya-invalid-json-${Date.now()}`
        );
        await mkdir(invalidJsonBinDir, { recursive: true });

        const invalidJsonScript = `#!/bin/bash
# Fake himalaya that outputs invalid JSON
echo "NOT_JSON_AT_ALL"
`;
        const invalidJsonBinPath = join(invalidJsonBinDir, "himalaya");
        await writeFile(invalidJsonBinPath, invalidJsonScript);
        await chmod(invalidJsonBinPath, 0o755);

        try {
          // Spawn server with invalid-JSON binary
          invalidJsonServerProcess = spawn("node", ["dist/index.js"], {
            cwd: PROJECT_ROOT,
            env: {
              ...process.env,
              HIMALAYA_BINARY: invalidJsonBinPath,
            },
            stdio: ["pipe", "pipe", "pipe"],
          });

          // Create a separate sendRequest for this server
          function sendInvalidJsonRequest(
            method: string,
            params?: any
          ): Promise<any> {
            const id = ++invalidJsonRequestId;
            const msg = JSON.stringify({
              jsonrpc: "2.0",
              id,
              method,
              params: params || {},
            });
            invalidJsonServerProcess!.stdin!.write(msg + "\n");

            return new Promise((resolve) => {
              invalidJsonPendingResolvers.set(id, resolve);
            });
          }

          // Parse responses
          invalidJsonServerProcess.stdout!.on("data", (chunk) => {
            invalidJsonResponseBuffer += chunk.toString();
            const lines = invalidJsonResponseBuffer.split("\n");
            invalidJsonResponseBuffer = lines.pop() || "";
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const msg = JSON.parse(line);
                if (msg.id && invalidJsonPendingResolvers.has(msg.id)) {
                  invalidJsonPendingResolvers.get(msg.id)!(msg);
                  invalidJsonPendingResolvers.delete(msg.id);
                }
              } catch {
                // Not JSON, skip
              }
            }
          });

          // Initialize
          const initResult = await sendInvalidJsonRequest("initialize", {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: { name: "invalid-json-test", version: "1.0.0" },
          });

          expect(initResult.result).toBeDefined();

          // Try to call list_emails
          const listResult = await sendInvalidJsonRequest("tools/call", {
            name: "list_emails",
            arguments: {},
          });

          // Expect error mentioning JSON or parse
          const hasParseError =
            listResult.error ||
            listResult.result?.isError ||
            (listResult.result?.content?.[0]?.text &&
              (listResult.result.content[0].text.includes("JSON") ||
                listResult.result.content[0].text.includes("parse") ||
                listResult.result.content[0].text.includes("invalid")));

          expect(hasParseError).toBeTruthy();
        } finally {
          if (invalidJsonServerProcess) {
            invalidJsonServerProcess.kill("SIGTERM");
          }
          await rm(invalidJsonBinDir, { recursive: true, force: true });
        }
      },
      10_000
    );
  });
});
