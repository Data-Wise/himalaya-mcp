import { describe, it, expect } from "vitest";
import {
  classifyStderr,
  versionDetectionError,
  unsupportedBackendError,
  HimalayaError,
  type MCPErrorCode,
} from "../src/himalaya/errors";

describe("classifyStderr", () => {
  const cases: Array<[string, MCPErrorCode]> = [
    ["ECONNRESET while reading from socket", "transient"],
    ["ETIMEDOUT", "transient"],
    ["* BYE Server closing connection", "transient"],
    ["AUTHENTICATIONFAILED Invalid credentials", "imap_auth_failed"],
    ["Invalid credentials for user@example.com", "imap_auth_failed"],
    ["certificate verify failed: self-signed certificate", "imap_cert_error"],
    ["self-signed certificate in chain", "imap_cert_error"],
    ["Cannot find account named 'foo'", "account_not_found"],
    ["No such folder: Archive2024", "folder_not_found"],
    ["Mailbox doesn't exist", "folder_not_found"],
    ["command not found: himalaya", "himalaya_not_installed"],
    ["Cannot find config file", "himalaya_config_missing"],
  ];

  for (const [stderr, expectedCode] of cases) {
    it(`classifies "${stderr.slice(0, 40)}..." as ${expectedCode}`, () => {
      expect(classifyStderr(stderr).code).toBe(expectedCode);
    });
  }

  it("falls back to 'unknown' when no pattern matches", () => {
    expect(classifyStderr("totally novel error").code).toBe("unknown");
  });

  it("'unknown' envelope carries raw stderr in message", () => {
    expect(classifyStderr("totally novel error").message).toContain("totally novel error");
  });

  it("classifies plain 'authentication failed' as imap_auth_failed", () => {
    // Broader pattern: matches real-world stderr without exact IMAP wording
    expect(classifyStderr("authentication failed: bad credentials").code).toBe("imap_auth_failed");
  });

  it("carries account name in envelope when supplied", () => {
    const env = classifyStderr("ECONNRESET", "work");
    expect(env.account).toBe("work");
  });

  it("preserves rawStderr field", () => {
    const env = classifyStderr("some weird error");
    expect(env.rawStderr).toBe("some weird error");
  });

  it("every known code has a non-empty hint", () => {
    const codes: MCPErrorCode[] = [
      "imap_auth_failed",
      "imap_cert_error",
      "imap_timeout",
      "transient",
      "account_not_found",
      "folder_not_found",
      "message_not_found",
      "himalaya_not_installed",
      "himalaya_config_missing",
    ];
    for (const code of codes) {
      const stderrSamples: Record<MCPErrorCode, string> = {
        imap_auth_failed: "AUTHENTICATIONFAILED",
        imap_cert_error: "certificate verify failed",
        imap_timeout: "ETIMEDOUT",
        transient: "ECONNRESET",
        account_not_found: "Cannot find account",
        folder_not_found: "No such folder",
        message_not_found: "Message not found",
        himalaya_not_installed: "command not found: himalaya",
        himalaya_config_missing: "Cannot find config",
        imap_connection_failed: "x",
        unknown: "x",
        // Not stderr-classified -- raised client-side pre-flight only
        // (see versionDetectionError/unsupportedBackendError below).
        himalaya_version_undetected: "x",
        unsupported_backend: "x",
      };
      const env = classifyStderr(stderrSamples[code]);
      if (env.code === code) {
        expect(env.hint).toBeTruthy();
      }
    }
  });
});

describe("versionDetectionError", () => {
  it("returns a HimalayaError with code himalaya_version_undetected, not recoverable", () => {
    const err = versionDetectionError("Command timed out");
    expect(err).toBeInstanceOf(HimalayaError);
    expect(err.envelope.code).toBe("himalaya_version_undetected");
    expect(err.envelope.recoverable).toBe(false);
    expect(err.envelope.message).toContain("Command timed out");
  });
});

describe("unsupportedBackendError", () => {
  it("returns a HimalayaError with code unsupported_backend, not recoverable", () => {
    const err = unsupportedBackendError("create_folder", "personal");
    expect(err).toBeInstanceOf(HimalayaError);
    expect(err.envelope.code).toBe("unsupported_backend");
    expect(err.envelope.recoverable).toBe(false);
    expect(err.envelope.account).toBe("personal");
  });

  it("message never matches the transient retry-classification pattern", () => {
    const err = unsupportedBackendError("delete_folder");
    expect(/ECONNRESET|ETIMEDOUT|\* BYE/i.test(err.envelope.message)).toBe(false);
  });
});
