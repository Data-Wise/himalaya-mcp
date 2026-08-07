/**
 * health_check MCP tool.
 *
 * Exposes per-account IMAP connectivity diagnostics during a Claude
 * conversation. Probes each configured account on BOTH the folder and
 * envelope surfaces (shared with the doctor CLI via probeAccountSurfaces)
 * and surfaces the structured error envelope (code + hint) on failure.
 *
 * Overall status:
 *   - healthy:   every account reachable on folders AND envelopes
 *   - degraded:  at least one account reachable, at least one failing
 *   - broken:    zero accounts reachable (or zero configured)
 *
 * An account counts as reachable when its folder surface works (primary);
 * a failing envelope surface alone degrades the account but is reported
 * in `surfaces` rather than flipping `reachable`.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listAccounts } from "../himalaya/accounts.js";
import type { HimalayaClient } from "../himalaya/client.js";
import { probeAccountSurfaces, type ProbeSurface } from "../himalaya/diagnostics.js";

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
  surfaces?: {
    folders: ProbeSurface;
    envelopes: ProbeSurface;
  };
}

interface HealthCheckResult {
  overall: "healthy" | "degraded" | "broken";
  himalayaVersion?: string;
  himalayaBinary?: string;
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
  } catch (err: unknown) {
    const hint = err instanceof Error ? err.message : String(err);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { overall: "broken", accounts: [], hint },
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

  // Resolve the CLI version + binary once for the whole check; a failed
  // probe here is surfaced as a hint, not fatal.
  let himalayaVersion: string | undefined;
  let himalayaBinary: string | undefined;
  try {
    const version = await client.resolveVersion();
    himalayaVersion = version.raw;
    himalayaBinary = client.binary;
  } catch (err: unknown) {
    himalayaVersion = undefined;
    himalayaBinary = undefined;
  }

  // Probe accounts in parallel so N-account latency is bounded by the
  // slowest probe, not the sum. Each probe still inherits transient-retry
  // from HimalayaClient.exec.
  const statuses: AccountStatus[] = await Promise.all(
    accounts.map(async (acc): Promise<AccountStatus> => {
      const probe = await probeAccountSurfaces(acc.name, client);
      return {
        name: acc.name,
        reachable: probe.reachable,
        code: probe.reachable ? undefined : probe.folders.code,
        message: probe.reachable ? undefined : probe.folders.message,
        hint: probe.reachable ? undefined : probe.folders.hint,
        attempts: probe.reachable ? undefined : probe.folders.attempts,
        surfaces: { folders: probe.folders, envelopes: probe.envelopes },
      };
    }),
  );

  const reachableCount = statuses.filter((s) => s.reachable).length;
  const allSurfacesOk =
    reachableCount === statuses.length &&
    statuses.every((s) => s.surfaces?.folders.ok && s.surfaces?.envelopes.ok);
  const overall: HealthCheckResult["overall"] =
    reachableCount === 0
      ? "broken"
      : allSurfacesOk
        ? "healthy"
        : "degraded";

  const result: HealthCheckResult = {
    overall,
    himalayaVersion,
    himalayaBinary,
    accounts: statuses,
  };
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
}

export function registerHealthTools(server: McpServer, client: HimalayaClient) {
  server.registerTool(
    "health_check",
    {
      description:
        "Check himalaya-mcp installation health and per-account IMAP connectivity (folder + envelope surfaces). Use when an email tool fails to diagnose which accounts are reachable.",
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
