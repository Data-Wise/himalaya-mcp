/**
 * Shared per-account diagnostic probing.
 *
 * Single source of truth for "is this account healthy?" used by BOTH the
 * health_check MCP tool and the doctor CLI. Probing the same surface set
 * through the same HimalayaClient path means the two can never drift again
 * (the #133 regression where doctor passed while the MCP tools failed).
 */

import type { HimalayaClient } from "./client.js";
import { HimalayaError, type MCPError } from "./errors.js";

export interface ProbeSurface {
  ok: boolean;
  code?: string;
  message?: string;
  hint?: string;
  attempts?: number;
}

export interface AccountProbe {
  folders: ProbeSurface;
  envelopes: ProbeSurface;
  /** An account is reachable when its primary (folder listing) surface works. */
  reachable: boolean;
}

function surfaceFromError(err: unknown): ProbeSurface {
  if (err instanceof HimalayaError) {
    const env: MCPError = err.envelope;
    return {
      ok: false,
      code: env.code,
      message: env.message,
      hint: env.hint,
      attempts: env.attempts,
    };
  }
  return {
    ok: false,
    code: "unknown",
    message: err instanceof Error ? err.message : String(err),
  };
}

/**
 * Probe both the folder and envelope surfaces for a single account.
 * Both inherit transient-retry from HimalayaClient.exec. Probes run
 * sequentially so downstream test mocks (and subprocess call ordering)
 * stay deterministic; each probe is a separate subprocess anyway.
 */
export async function probeAccountSurfaces(
  account: string,
  client: HimalayaClient,
): Promise<AccountProbe> {
  let folders: ProbeSurface;
  try {
    await client.listFolders(account);
    folders = { ok: true };
  } catch (err: unknown) {
    folders = surfaceFromError(err);
  }

  let envelopes: ProbeSurface;
  try {
    await client.listEnvelopes(undefined, 1, undefined, account);
    envelopes = { ok: true };
  } catch (err: unknown) {
    envelopes = surfaceFromError(err);
  }

  return { folders, envelopes, reachable: folders.ok };
}
