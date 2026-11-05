/**
 * Global test guard: no test may reach the real himalaya.
 *
 * A client built without an explicit binary resolves `himalaya` from PATH,
 * which on a developer machine is the real CLI with real accounts. A test
 * that forgot to pin the version or mock a method once took the v2 send
 * path and sent actual email. Every test run now finds a stub first on PATH
 * that refuses every command, so such a test fails loudly instead of
 * talking to a mail server. Tests that need a binary pass their own fake
 * (HIMALAYA_BINARY / the `binary` option), which this does not affect.
 */
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

let dir: string | undefined;

export function setup(): void {
  dir = mkdtempSync(join(tmpdir(), "himalaya-guard-"));
  const stub = join(dir, "himalaya");
  writeFileSync(
    stub,
    '#!/bin/sh\necho "himalaya-mcp tests: the real himalaya is blocked (args: $*)" >&2\nexit 97\n',
  );
  chmodSync(stub, 0o755);
  process.env.PATH = `${dir}${delimiter}${process.env.PATH ?? ""}`;
}

export function teardown(): void {
  if (dir) rmSync(dir, { recursive: true, force: true });
}
