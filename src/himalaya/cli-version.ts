/**
 * himalaya CLI version detection.
 *
 * himalaya made a breaking CLI change at v2.0.0 (subcommand `folder`->`mailbox`,
 * flag `--output json`->`--json`, `folder create`/`folder delete` dropped from
 * the shared API). HimalayaClient needs to know which syntax generation the
 * installed binary speaks before building any args.
 *
 * No module-level cache here by design: HimalayaClient caches per-instance
 * (lazy, on first exec()); doctor calls this fresh every run since it's a
 * one-shot CLI invocation in its own process with nothing to share.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { versionDetectionError } from "./errors.js";

const execFileAsync = promisify(execFile);

// Independent of HimalayaClient's command timeout (default 120s) -- a hung
// or misbehaving binary should stall the version probe briefly, not the
// whole first tool call.
const VERSION_PROBE_TIMEOUT_MS = 5_000;

export interface HimalayaVersion {
  /** Major version number, e.g. 2 for "himalaya v2.0.0 ...". */
  major: number;
  /** Raw `--version` stdout, trimmed, for diagnostics/logging. */
  raw: string;
}

// Matches "himalaya v2.0.0 +gmail ..." (confirmed live format) and a bare
// "1.1.0"-style form without the "v" prefix -- real v1.x --version output
// was never independently verified (only v2.0.0 was live-tested), so the
// "v" is optional rather than assumed present.
const VERSION_RE = /\bv?(\d+)\.\d+\.\d+\b/;

/**
 * Run `<binary> --version` and extract the major version number.
 * Throws a HimalayaError (code: "himalaya_version_undetected") on timeout,
 * nonzero exit, or unparseable/empty output -- callers must not silently
 * default to a syntax branch on failure.
 */
export async function detectHimalayaVersion(binary: string): Promise<HimalayaVersion> {
  let stdout: string;
  try {
    const result = await execFileAsync(binary, ["--version"], {
      timeout: VERSION_PROBE_TIMEOUT_MS,
    });
    stdout = result.stdout.trim();
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err);
    throw versionDetectionError(detail);
  }

  const match = VERSION_RE.exec(stdout);
  if (!match) {
    throw versionDetectionError(`unrecognized --version output: "${stdout || "(empty)"}"`);
  }

  return { major: parseInt(match[1], 10), raw: stdout };
}
