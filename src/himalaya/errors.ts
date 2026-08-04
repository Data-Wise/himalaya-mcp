/**
 * Structured error envelope for himalaya-mcp.
 *
 * Classifies stderr text into stable error codes so downstream tools and
 * future retry logic can act on the failure mode without parsing strings.
 */

export type MCPErrorCode =
  | "imap_connection_failed"
  | "imap_auth_failed"
  | "imap_timeout"
  | "imap_cert_error"
  | "account_not_found"
  | "folder_not_found"
  | "message_not_found"
  | "himalaya_not_installed"
  | "himalaya_config_missing"
  | "himalaya_version_undetected"
  | "unsupported_backend"
  | "parse_error"
  | "transient"
  | "unknown";

export interface MCPError {
  code: MCPErrorCode;
  message: string;
  hint?: string;
  account?: string;
  recoverable: boolean;
  attempts?: number;
  rawStderr?: string;
}

interface Pattern {
  re: RegExp;
  code: MCPErrorCode;
  hint: string;
  recoverable: boolean;
}

const PATTERNS: Pattern[] = [
  {
    re: /ECONNRESET|ETIMEDOUT|\* BYE/i,
    code: "transient",
    hint: "Transient network issue (auto-retried). If persistent, check network or VPN.",
    recoverable: true,
  },
  {
    // Broader than the spec: also matches lowercase "authentication failed"
    // produced by himalaya itself, "login failed/error" variants, and
    // "auth(?:entication)? rejected" forms surfaced by some IMAP servers.
    re: /AUTHENTICATIONFAILED|Invalid credentials|authentication failed|login (?:failed|error|rejected)|auth(?:entication)? rejected/i,
    code: "imap_auth_failed",
    hint: "Re-check app password. Run: himalaya account configure <account>",
    recoverable: true,
  },
  {
    re: /certificate verify failed|self-signed certificate/i,
    code: "imap_cert_error",
    hint: "Trust the cert or set imap-encryption-tls.insecure (NOT for production)",
    recoverable: true,
  },
  {
    re: /Cannot find account/i,
    code: "account_not_found",
    hint: "Run: himalaya account list",
    recoverable: true,
  },
  {
    re: /No such folder|Mailbox doesn't exist/i,
    code: "folder_not_found",
    hint: "Run: himalaya folder list",
    recoverable: true,
  },
  {
    re: /Message not found/i,
    code: "message_not_found",
    hint: "UID may be stale; refresh the inbox listing",
    recoverable: true,
  },
  {
    re: /command not found: himalaya|spawn himalaya ENOENT/i,
    code: "himalaya_not_installed",
    hint: "Run: brew install himalaya",
    recoverable: true,
  },
  {
    re: /Cannot find config/i,
    code: "himalaya_config_missing",
    hint: "Run: himalaya account configure",
    recoverable: true,
  },
];

/**
 * Classify a raw stderr string into a structured MCPError envelope.
 * Falls through to code: "unknown" with the raw stderr preserved.
 */
export function classifyStderr(stderr: string, account?: string): MCPError {
  for (const p of PATTERNS) {
    if (p.re.test(stderr)) {
      return {
        code: p.code,
        message: stderr.trim(),
        hint: p.hint,
        account,
        recoverable: p.recoverable,
        rawStderr: stderr,
      };
    }
  }
  return {
    code: "unknown",
    message: stderr.trim() || "Unknown himalaya error",
    account,
    recoverable: false,
    rawStderr: stderr,
  };
}

/**
 * Build a HimalayaError for parser failures so the MCP response shape is
 * invariant: every tool error reaches Claude as `{ error: MCPError }` JSON,
 * regardless of whether the subprocess or the JSON parser produced it.
 */
export function parseError(detail: string, account?: string): HimalayaError {
  return new HimalayaError({
    code: "parse_error",
    message: `himalaya output failed to parse: ${detail}`,
    hint: "This usually indicates a himalaya version mismatch or corrupt response. Run: himalaya --version",
    account,
    recoverable: false,
  });
}

/**
 * Build a HimalayaError for a failed/timed-out/unparseable `himalaya --version`
 * probe. Distinct from "himalaya_not_installed" (binary missing entirely) and
 * from a generic "unknown" exec failure — the caller needs to know version
 * detection itself failed, not that a real command failed.
 */
export function versionDetectionError(detail: string): HimalayaError {
  return new HimalayaError({
    code: "himalaya_version_undetected",
    message: `Could not detect himalaya CLI version: ${detail}`,
    hint: "Run: himalaya --version. If it hangs or errors, reinstall: brew reinstall himalaya",
    recoverable: false,
  });
}

/**
 * Build a HimalayaError for an operation (e.g. folder create/delete) that has
 * no implementation for the account's backend. Raised client-side, pre-flight
 * — before any subprocess is spawned — so it never risks being classified as
 * a "transient" stderr pattern and retried.
 */
export function unsupportedBackendError(operation: string, account?: string): HimalayaError {
  return new HimalayaError({
    code: "unsupported_backend",
    message: `${operation} is not supported for this account's backend.`,
    hint: "This operation currently requires an IMAP-backed account.",
    account,
    recoverable: false,
  });
}

/**
 * Error type carrying a structured MCPError envelope.
 * Thrown by HimalayaClient on subprocess failure; caught by tool handlers
 * and surfaced as a JSON-formatted MCP error response.
 */
export class HimalayaError extends Error {
  envelope: MCPError;
  constructor(envelope: MCPError) {
    super(envelope.message);
    this.name = "HimalayaError";
    this.envelope = envelope;
  }
}
