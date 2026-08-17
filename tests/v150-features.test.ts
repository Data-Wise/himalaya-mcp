/**
 * v1.5.0 Feature Integration Tests
 *
 * Tests the new features by running actual commands and verifying output:
 * - SessionStart hook script execution
 * - Plugin.json structure validation
 * - Thread tools via live MCP server
 * - Morning/inbox-check prompts via live MCP server
 * - Skill description natural language coverage
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "..");

// ─────────────────────────────────────────────────
// SessionStart Hook Tests
// ─────────────────────────────────────────────────

describe("v1.5.0: SessionStart hook", () => {
  const hookPath = join(
    PROJECT_ROOT,
    "himalaya-mcp-plugin/hooks/session-start.sh",
  );

  it("hook script executes and outputs valid JSON", async () => {
    const { stdout } = await execFileAsync("/bin/bash", [hookPath]);
    const parsed = JSON.parse(stdout.trim());
    expect(parsed).toBeDefined();
  });

  it("output contains additionalContext key", async () => {
    const { stdout } = await execFileAsync("/bin/bash", [hookPath]);
    const parsed = JSON.parse(stdout.trim());
    expect(parsed).toHaveProperty("additionalContext");
    expect(typeof parsed.additionalContext).toBe("string");
  });

  it("additionalContext mentions email tools", async () => {
    const { stdout } = await execFileAsync("/bin/bash", [hookPath]);
    const { additionalContext } = JSON.parse(stdout.trim());
    expect(additionalContext).toContain("himalaya");
    expect(additionalContext).toContain("MCP tools");
  });

  it("additionalContext lists all skill commands", async () => {
    const { stdout } = await execFileAsync("/bin/bash", [hookPath]);
    const { additionalContext } = JSON.parse(stdout.trim());
    const expectedSkills = [
      "/himalaya:inbox",
      "/himalaya:triage",
      "/himalaya:digest",
      "/himalaya:compose",
      "/himalaya:reply",
      "/himalaya:search",
      "/himalaya:manage",
      "/himalaya:attachments",
      "/himalaya:stats",
      "/himalaya:config",
      "/himalaya:help",
    ];
    for (const skill of expectedSkills) {
      expect(additionalContext).toContain(skill);
    }
  });

  it("additionalContext mentions natural trigger words", async () => {
    const { stdout } = await execFileAsync("/bin/bash", [hookPath]);
    const { additionalContext } = JSON.parse(stdout.trim());
    expect(additionalContext).toContain("email");
    expect(additionalContext).toContain("inbox");
    expect(additionalContext).toContain("triage");
  });
});

// ─────────────────────────────────────────────────
// Plugin.json Structure Tests
// ─────────────────────────────────────────────────

describe("v1.5.0: plugin.json hook structure", () => {
  let pluginJson: any;

  beforeAll(async () => {
    const raw = await readFile(
      join(PROJECT_ROOT, "himalaya-mcp-plugin/.claude-plugin/plugin.json"),
      "utf-8",
    );
    pluginJson = JSON.parse(raw);
  });

  it("has SessionStart hook registered", () => {
    expect(pluginJson.hooks).toHaveProperty("SessionStart");
    expect(pluginJson.hooks.SessionStart).toBeInstanceOf(Array);
    expect(pluginJson.hooks.SessionStart.length).toBeGreaterThan(0);
  });

  it("SessionStart hook uses command type", () => {
    const hook = pluginJson.hooks.SessionStart[0].hooks[0];
    expect(hook.type).toBe("command");
  });

  it("SessionStart hook command references session-start.sh", () => {
    const hook = pluginJson.hooks.SessionStart[0].hooks[0];
    expect(hook.command).toContain("session-start.sh");
  });

  it("SessionStart hook uses CLAUDE_PLUGIN_ROOT", () => {
    const hook = pluginJson.hooks.SessionStart[0].hooks[0];
    expect(hook.command).toContain("${CLAUDE_PLUGIN_ROOT}");
  });

  it("still has PreToolUse hook (pre-send)", () => {
    expect(pluginJson.hooks).toHaveProperty("PreToolUse");
    expect(pluginJson.hooks.PreToolUse.length).toBeGreaterThan(0);
  });

  it("description reflects updated counts", () => {
    expect(pluginJson.description).toContain("29 tools");
    expect(pluginJson.description).toContain("7 prompts");
    expect(pluginJson.description).toContain("16 skills");
    expect(pluginJson.description).toContain("2 hooks");
  });

  it("version is 2.1.2", () => {
    expect(pluginJson.version).toBe("2.1.2");
  });
});

// ─────────────────────────────────────────────────
// Skill Description Coverage Tests
// ─────────────────────────────────────────────────

describe("v1.5.0: broadened skill descriptions", () => {
  const skillDir = join(PROJECT_ROOT, "himalaya-mcp-plugin/skills");

  async function readSkillDescription(name: string): Promise<string> {
    const raw = await readFile(join(skillDir, name, "SKILL.md"), "utf-8");
    const match = raw.match(/^description:\s*(.+)$/m);
    return match ? match[1] : "";
  }

  it("inbox skill has natural language triggers", async () => {
    const desc = await readSkillDescription("inbox");
    expect(desc).toContain("any new messages");
    expect(desc).toContain("what's in my email");
    expect(desc).toContain("unread emails");
  });

  it("triage skill has natural language triggers", async () => {
    const desc = await readSkillDescription("triage");
    expect(desc).toContain("what needs attention");
    expect(desc).toContain("prioritize my email");
  });

  it("digest skill has natural language triggers", async () => {
    const desc = await readSkillDescription("digest");
    expect(desc).toContain("email digest");
    expect(desc).toContain("summarize my inbox");
  });

  it("compose skill has natural language triggers", async () => {
    const desc = await readSkillDescription("compose");
    expect(desc).toContain("send a message to");
    expect(desc).toContain("email someone");
  });

  it("reply skill has natural language triggers", async () => {
    const desc = await readSkillDescription("reply");
    expect(desc).toContain("answer that email");
    expect(desc).toContain("get back to them");
  });

  it("search skill has natural language triggers", async () => {
    const desc = await readSkillDescription("search");
    expect(desc).toContain("did I get an email about");
    expect(desc).toContain("find message from");
  });

  it("manage skill has natural language triggers", async () => {
    const desc = await readSkillDescription("manage");
    expect(desc).toContain("mark as read");
    expect(desc).toContain("star this email");
  });

  it("attachments skill has natural language triggers", async () => {
    const desc = await readSkillDescription("attachments");
    expect(desc).toContain("download the file");
    expect(desc).toContain("what files were attached");
  });

  it("stats skill has natural language triggers", async () => {
    const desc = await readSkillDescription("stats");
    expect(desc).toContain("how many emails");
    expect(desc).toContain("inbox count");
  });

  it("morning skill exists and has correct triggers", async () => {
    const desc = await readSkillDescription("morning");
    expect(desc).toContain("morning briefing");
    expect(desc).toContain("start my day");
    expect(desc).toContain("catch me up on email");
  });

  it("respond skill has natural language triggers for batch reply", async () => {
    const desc = await readSkillDescription("respond");
    expect(desc).toContain("respond to all");
    expect(desc).toContain("batch reply");
    expect(desc).toContain("mass respond");
    expect(desc).toContain("bulk respond");
  });

  it("all 16 skills use enhanced description pattern", async () => {
    const skillNames = [
      "inbox", "triage", "digest", "compose", "reply",
      "forward", "attachments", "export", "threads",
      "search", "manage", "stats", "config",
      "help", "morning", "respond",
    ];
    for (const name of skillNames) {
      const desc = await readSkillDescription(name);
      expect(desc).toContain("This skill should be used when");
    }
  });
});

// ─────────────────────────────────────────────────
// MCP Server Live Tests (threads + prompts)
// ─────────────────────────────────────────────────

describe("v1.5.0: thread tools via MCP server", () => {
  let fakeBinDir: string;
  let serverProcess: ReturnType<typeof spawn>;
  let responseBuffer = "";
  const pendingResolvers = new Map<number, (value: any) => void>();
  let requestId = 0;

  // Fake himalaya with multiple envelopes for threading
  const THREAD_ENVELOPES = JSON.stringify([
    {
      id: "1", flags: ["Seen"], subject: "Project kickoff",
      from: { name: "Alice", addr: "alice@test.com" },
      to: { name: null, addr: "me@test.com" },
      date: "2026-03-15 09:00", has_attachment: false,
    },
    {
      id: "2", flags: [], subject: "Re: Project kickoff",
      from: { name: "Bob", addr: "bob@test.com" },
      to: { name: null, addr: "me@test.com" },
      date: "2026-03-15 10:00", has_attachment: false,
    },
    {
      id: "3", flags: [], subject: "Re: Project kickoff",
      from: { name: "Alice", addr: "alice@test.com" },
      to: { name: null, addr: "me@test.com" },
      date: "2026-03-15 11:00", has_attachment: false,
    },
    {
      id: "10", flags: ["Seen"], subject: "Lunch plans",
      from: { name: "Charlie", addr: "charlie@test.com" },
      to: { name: null, addr: "me@test.com" },
      date: "2026-03-16 12:00", has_attachment: false,
    },
    {
      id: "20", flags: [], subject: "Budget review",
      from: { name: "Diana", addr: "diana@test.com" },
      to: { name: null, addr: "me@test.com" },
      date: "2026-03-17 08:00", has_attachment: false,
    },
  ]);

  async function createFakeHimalaya(dir: string) {
    // Write response files — avoids shell escaping issues with JSON
    await writeFile(join(dir, "envelopes.json"), THREAD_ENVELOPES);
    await writeFile(join(dir, "message.json"), '"Message body for testing threads."');
    await writeFile(join(dir, "folders.json"), '[{"name":"INBOX","desc":""}]');
    const script = `#!/bin/bash
if [ "$1" = "--version" ]; then
  echo "himalaya 1.1.0"
  exit 0
fi
args="$*"
DIR="$(cd "$(dirname "$0")" && pwd)"
clean=$(echo "$args" | sed 's/--account [^ ]* //g' | sed 's/--output json //g')
if echo "$clean" | grep -q "envelope list"; then
  cat "$DIR/envelopes.json"
elif echo "$clean" | grep -q "message read"; then
  cat "$DIR/message.json"
elif echo "$clean" | grep -q "folder list"; then
  cat "$DIR/folders.json"
else
  echo '[]'
fi
`;
    await writeFile(join(dir, "himalaya"), script);
    await chmod(join(dir, "himalaya"), 0o755);
  }

  function sendRequest(method: string, params?: any): Promise<any> {
    const id = ++requestId;
    const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params: params || {} });
    serverProcess.stdin!.write(msg + "\n");
    return new Promise((resolve) => {
      pendingResolvers.set(id, resolve);
    });
  }

  beforeAll(async () => {
    fakeBinDir = join(tmpdir(), `himalaya-thread-test-${Date.now()}`);
    await mkdir(fakeBinDir, { recursive: true });
    await createFakeHimalaya(fakeBinDir);

    serverProcess = spawn("node", [join(PROJECT_ROOT, "dist/index.js")], {
      env: {
        ...process.env,
        PATH: `${fakeBinDir}:${process.env.PATH}`,
        HIMALAYA_BINARY: join(fakeBinDir, "himalaya"),
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    serverProcess.stdout!.on("data", (chunk: Buffer) => {
      responseBuffer += chunk.toString();
      const lines = responseBuffer.split("\n");
      responseBuffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id && pendingResolvers.has(msg.id)) {
            pendingResolvers.get(msg.id)!(msg);
            pendingResolvers.delete(msg.id);
          }
        } catch {}
      }
    });

    // Initialize
    await sendRequest("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "v150-test", version: "1.0.0" },
    });
  }, 60_000);

  afterAll(() => {
    serverProcess?.kill();
  });

  it("list_threads returns grouped conversations", async () => {
    const result = await sendRequest("tools/call", {
      name: "list_threads",
      arguments: {},
    });
    const text = result.result.content[0].text;
    // Should group 5 envelopes into 3 threads
    expect(text).toContain("3 threads");
    expect(text).toContain("5 emails");
  });

  it("list_threads shows thread with multiple messages", async () => {
    const result = await sendRequest("tools/call", {
      name: "list_threads",
      arguments: {},
    });
    const text = result.result.content[0].text;
    // "Project kickoff" has 3 messages (original + 2 replies)
    expect(text).toContain("3 messages");
  });

  it("list_threads shows participant names", async () => {
    const result = await sendRequest("tools/call", {
      name: "list_threads",
      arguments: {},
    });
    const text = result.result.content[0].text;
    expect(text).toContain("Alice");
    expect(text).toContain("Bob");
  });

  it("list_threads marks unread threads", async () => {
    const result = await sendRequest("tools/call", {
      name: "list_threads",
      arguments: {},
    });
    const text = result.result.content[0].text;
    // "Project kickoff" thread has unread messages (Bob and Alice's replies)
    expect(text).toContain("[unread]");
  });

  it("read_thread returns messages in chronological order", async () => {
    const result = await sendRequest("tools/call", {
      name: "read_thread",
      arguments: { thread_id: "1" },
    });
    const text = result.result.content[0].text;
    expect(text).toContain("Thread: Project kickoff");
    expect(text).toContain("3 messages");
    expect(text).toContain("Message 1");
    expect(text).toContain("Message 2");
    expect(text).toContain("Message 3");
  });

  it("read_thread shows participant info", async () => {
    const result = await sendRequest("tools/call", {
      name: "read_thread",
      arguments: { thread_id: "1" },
    });
    const text = result.result.content[0].text;
    expect(text).toContain("Alice");
    expect(text).toContain("Bob");
    expect(text).toContain("Participants:");
  });

  it("read_thread returns error for unknown thread", async () => {
    const result = await sendRequest("tools/call", {
      name: "read_thread",
      arguments: { thread_id: "99999" },
    });
    const text = result.result.content[0].text;
    expect(text).toContain("Thread not found");
    expect(result.result.isError).toBe(true);
  });
});

describe("v1.5.0: morning/inbox prompts via MCP server", () => {
  let fakeBinDir: string;
  let serverProcess: ReturnType<typeof spawn>;
  let responseBuffer = "";
  const pendingResolvers = new Map<number, (value: any) => void>();
  let requestId = 100;

  async function createFakeHimalaya(dir: string) {
    const script = `#!/bin/bash
if [ "$1" = "--version" ]; then
  echo "himalaya 1.1.0"
  exit 0
fi
echo '[]'
`;
    await writeFile(join(dir, "himalaya"), script);
    await chmod(join(dir, "himalaya"), 0o755);
  }

  function sendRequest(method: string, params?: any): Promise<any> {
    const id = ++requestId;
    const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params: params || {} });
    serverProcess.stdin!.write(msg + "\n");
    return new Promise((resolve) => {
      pendingResolvers.set(id, resolve);
    });
  }

  beforeAll(async () => {
    fakeBinDir = join(tmpdir(), `himalaya-prompt-test-${Date.now()}`);
    await mkdir(fakeBinDir, { recursive: true });
    await createFakeHimalaya(fakeBinDir);

    serverProcess = spawn("node", [join(PROJECT_ROOT, "dist/index.js")], {
      env: {
        ...process.env,
        PATH: `${fakeBinDir}:${process.env.PATH}`,
        HIMALAYA_BINARY: join(fakeBinDir, "himalaya"),
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    serverProcess.stdout!.on("data", (chunk: Buffer) => {
      responseBuffer += chunk.toString();
      const lines = responseBuffer.split("\n");
      responseBuffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id && pendingResolvers.has(msg.id)) {
            pendingResolvers.get(msg.id)!(msg);
            pendingResolvers.delete(msg.id);
          }
        } catch {}
      }
    });

    // CI runners can be slow to JIT-compile dist/index.js on cold start;
    // bump the budget to 120s to absorb startup variance.
    await sendRequest("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "v150-prompt-test", version: "1.0.0" },
    });
  }, 120_000);

  afterAll(() => {
    serverProcess?.kill();
  });

  it("morning_briefing prompt is callable and returns messages", async () => {
    const result = await sendRequest("prompts/get", {
      name: "morning_briefing",
      arguments: {},
    });
    expect(result.result.messages).toBeInstanceOf(Array);
    expect(result.result.messages.length).toBeGreaterThan(0);
  });

  it("morning_briefing prompt mentions urgency classification", async () => {
    const result = await sendRequest("prompts/get", {
      name: "morning_briefing",
      arguments: {},
    });
    const text = result.result.messages[0].content.text;
    expect(text).toContain("Needs Reply Today");
    expect(text).toContain("FYI");
    expect(text).toContain("Newsletter");
  });

  it("morning_briefing prompt includes account when specified", async () => {
    const result = await sendRequest("prompts/get", {
      name: "morning_briefing",
      arguments: { account: "work" },
    });
    const text = result.result.messages[0].content.text;
    expect(text).toContain("work");
  });

  it("inbox_check prompt is callable and returns messages", async () => {
    const result = await sendRequest("prompts/get", {
      name: "inbox_check",
      arguments: {},
    });
    expect(result.result.messages).toBeInstanceOf(Array);
    expect(result.result.messages.length).toBeGreaterThan(0);
  });

  it("inbox_check prompt defaults to INBOX", async () => {
    const result = await sendRequest("prompts/get", {
      name: "inbox_check",
      arguments: {},
    });
    const text = result.result.messages[0].content.text;
    expect(text).toContain("INBOX");
  });

  it("inbox_check prompt uses custom folder", async () => {
    const result = await sendRequest("prompts/get", {
      name: "inbox_check",
      arguments: { folder: "Sent" },
    });
    const text = result.result.messages[0].content.text;
    expect(text).toContain("Sent");
  });
});
