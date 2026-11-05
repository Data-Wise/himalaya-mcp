# Decision: clear the CI audit gate with an override and a major bump, not a relaxed gate

**Status:** Accepted
**Date:** 2026-11-04
**Implemented in:** #151 (`bedc0e5`) and #157 (`ee93812`)

## Context

CI runs `npm audit --audit-level=high` and went red on advisories published after v2.1.2, although #151 changed no dependencies (16 findings: 1 critical, 8 high). `npm audit fix` cleared most of them by refreshing the lockfile. Two remained:

- `zod` under `@anthropic-ai/mcpb`: that dev dependency pins zod 3.x, which is flagged, with no fixed 3.x release.
- `postal-mime` ^3.0.0 (added by #157): GHSA-f2hq-32vh-53cc, high, quadratic CPU on certain RFC 2047 headers. It parses untrusted mail. Fixed in 4.2.0 (a semver major).

## Decision

- Add `"overrides": {"@anthropic-ai/mcpb": {"zod": "$zod"}}` so the mcpb build tool uses the root zod 4.6.7.
- Bump `postal-mime` to ^4.2.0; no code change was needed.
- Keep the gate at `--audit-level=high`.

Checks done before accepting the override: the `.mcpb` builds; its server answered `initialize` and listed 29 tools over stdio; the v2.1.3 `.mcpb` installed through Claude Desktop's dialog and its log showed `tools/list`, `prompts/list` and `resources/list` answered (2026-11-04).

## Alternatives considered

### Relax or skip the audit gate
- Rejected: the gate caught a real advisory in the mail parser.

### `npm audit fix --force`
- Not used: it would also take semver-major bumps in unrelated tools without a reason tied to the advisory.

### Keep `postal-mime` 3
- Rejected: it is the parser for untrusted input, and the fix was available.

## Consequences

- `@anthropic-ai/mcpb` (a build-time dev dependency) runs on a zod major it was not built against. Revisit when mcpb ships a release with a fixed zod, and drop the override then.
- Three moderate `vitest` advisories remain; they need a semver-major bump and do not trip the high-level gate.
- An advisory published tomorrow can turn the gate red on any PR. A gate that fails only on advisories new relative to the base branch, plus a scheduled full audit, would avoid blocking unrelated work; not done here.
