/**
 * health_check MCP tool.
 *
 * Exposes per-account IMAP connectivity diagnostics during a Claude
 * conversation. Probes each configured account with `folder list`
 * (which inherits transient-retry from HimalayaClient.exec) and
 * surfaces the structured error envelope (code + hint) on failure.
 *
 * Overall status:
 *   - healthy:   all probed accounts reachable
 *   - degraded:  at least one reachable, at least one failing
 *   - broken:    zero reachable (or zero configured)
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listAccounts } from "../himalaya/accounts.js";
import type { HimalayaClient } from "../himalaya/client.js";
import { HimalayaError, type MCPError } from "../himalaya/errors.js";

interface HealthCheckArgs {
  account?: string;
}

interface AccountStatus {
  name: string;
  reachable: boolean;
  code?: string;
  message?: string;
  hint?: string;
  attempts?: number;
}

interface HealthCheckResult {
  overall: "healthy" | "degraded" | "broken";
  accounts: AccountStatus[];
  hint?: string;
}

export async function handleHealthCheck(
  args: HealthCheckArgs,
  client: HimalayaClient,
): Promise<{ content: { type: "text"; text: string }[] }> {
  let accounts;
  try {
    accounts = await listAccounts();
  } catch (err: any) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { overall: "broken", accounts: [], hint: err?.message ?? String(err) },
            null,
            2,
          ),
        },
      ],
    };
  }

  if (args.account) {
    accounts = accounts.filter((a) => a.name === args.account);
  }

  if (accounts.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              overall: "broken",
              accounts: [],
              hint: "No accounts configured. Run: himalaya account configure",
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  const statuses: AccountStatus[] = [];
  for (const acc of accounts) {
    try {
      await client.listFolders(acc.name);
      statuses.push({ name: acc.name, reachable: true });
    } catch (err) {
      if (err instanceof HimalayaError) {
        const env: MCPError = err.envelope;
        statuses.push({
          name: acc.name,
          reachable: false,
          code: env.code,
          message: env.message,
          hint: env.hint,
          attempts: env.attempts,
        });
      } else {
        throw err;
      }
    }
  }

  const reachableCount = statuses.filter((s) => s.reachable).length;
  const overall: HealthCheckResult["overall"] =
    reachableCount === statuses.length
      ? "healthy"
      : reachableCount === 0
        ? "broken"
        : "degraded";

  const result: HealthCheckResult = { overall, accounts: statuses };
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
}

export function registerHealthTools(server: McpServer, client: HimalayaClient) {
  server.registerTool(
    "health_check",
    {
      description:
        "Check himalaya-mcp installation health and per-account IMAP connectivity. Use when an email tool fails to diagnose which accounts are reachable.",
      inputSchema: {
        account: z
          .string()
          .optional()
          .describe(
            "Optional. Specific account to test (default: all configured accounts).",
          ),
      },
    },
    async (args) => handleHealthCheck(args, client),
  );
}
