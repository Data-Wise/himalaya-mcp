# Plan: himalaya CLI v1.x/v2.x Dual Compatibility Fix

**Spec:** [docs/specs/SPEC-himalaya-v2-cli-compat-2026-08-03.md](../docs/specs/SPEC-himalaya-v2-cli-compat-2026-08-03.md)
(Phase 1 complete — 2 adversarial reviews incorporated, 1 CRITICAL finding resolved with live
verification against a real IMAP account, all open questions resolved by the user)

**Precursor:** [docs/specs/BUG-himalaya-v2-cli-incompatibility-2026-08-03.md](../docs/specs/BUG-himalaya-v2-cli-incompatibility-2026-08-03.md)

## Components

| # | Component | New/Modified | Depends on |
|---|---|---|---|
| 1 | `src/himalaya/cli-version.ts` | NEW | — |
| 2 | `src/himalaya/errors.ts` (`unsupported_backend` code) | Modified | — |
| 3 | `src/himalaya/accounts.ts` (`backends` on `Account`, `isImapAccount()`) | Modified | — |
| 4 | `src/himalaya/client.ts` — `execOnce()` / `listFolders()` dual-syntax | Modified | 1 |
| 5 | `src/himalaya/client.ts` — `createFolder()`/`deleteFolder()` dual-path + namespace check | Modified | 1, 2, 3, 4 |
| 6 | `src/cli/doctor.ts` — version/branch reporting | Modified | 1 |
| 7 | CI argv fixture (`tests/fixtures/fake-himalaya/` + smoke test) | NEW | 1 (conceptually; sourced from bug-report transcripts, not from 4/5's code, so buildable in parallel) |
| 8 | Docs (`installation.md`, `desktop-extension.md`, `diagnose-issues.md`, `CLAUDE.md`) | Modified | 4, 5, 6 (final behavior must be locked first) |

## Implementation order

```
Phase A (parallel, no interdependencies):
  1. cli-version.ts + its unit tests
  2. errors.ts unsupported_backend code
  3. accounts.ts backends exposure + isImapAccount()
  7. CI fixture script + fixture content (sourced from BUG-*.md transcripts — does NOT
     need 4/5's implementation to exist first, only needs the bug report, which is already
     written)

Phase B (sequential, depends on Phase A):
  4. client.ts execOnce()/listFolders() dual-syntax           [needs 1]
  5. client.ts createFolder()/deleteFolder() dual-path         [needs 1, 2, 3, 4]
  6. doctor.ts version/branch reporting                        [needs 1]

Phase C (after B is behaviorally complete):
  7b. Wire the CI fixture as an actual test file exercising the real client (needs 4, 5
      to exist so there's something to point the fixture at)
  8. Docs + CLAUDE.md updates

Phase D (final gate):
  9. Full verification pass (build, bundle, full test suite, manual live check)
```

Rationale for this ordering: `cli-version.ts` (1) is the one true foundation everything else
branches on — build and test it first, in isolation, before anything depends on it. `errors.ts`
(2) and `accounts.ts` (3) are independent, narrow, additive changes with no shared surface — can
happen anytime, in parallel with 1 or with each other. The CI fixture's *content* (7) is
deliberately front-loaded into Phase A specifically to satisfy the spec's anti-self-confirmation
requirement — it must be authored from the bug report's transcripts before task 5 exists, or the
fixture and the implementation risk encoding the same wrong assumption together. Task 5 is the
riskiest single unit (three adversarial-review findings landed here: fail-closed backend
detection, namespace-safety check, and the resolved-but-still-delicate imap create/delete
mapping) so it's sequenced after everything it depends on is solid, not bundled into task 4.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Version-detection timeout logic (5s) is itself untested against a genuinely hanging process | `cli-version.test.ts` includes a deliberately slow-responding fake binary case, not just fast success/failure strings |
| Task 5's fail-closed backend check has the widest blast radius if wrong (could either wrongly block IMAP accounts or wrongly allow non-IMAP ones through) | Explicit test matrix in `folders.test.ts`: (IMAP+valid name) pass, (non-IMAP) blocked, (missing `backends`) blocked, (malformed `backends`) blocked, (namespace-unsafe name on IMAP) blocked — five branches, five tests, no shared assertion |
| CI fixture built from bug-report transcripts might miss an argv shape the real implementation ends up needing (e.g. `--account` flag ordering) | Task 7b (wiring) happens after task 4/5 land — if the implementation needs an argv shape the fixture doesn't recognize, the smoke test fails loudly rather than silently passing; extend the fixture at that point rather than pre-guessing every shape now |
| Existing 619 mocked tests could break en masse from the version-parameterization change (task 4) | Land task 4 as its own commit/checkpoint and run the full suite before starting task 5, so a regression is attributable to one component, not a pile of changes |

## Verification checkpoints

- **After Phase A:** `npm test -- cli-version accounts errors` green in isolation; no other
  test files touched yet, so the rest of the suite is an unaffected baseline.
- **After task 4:** `npm test` full suite green (this is the highest-blast-radius single change
  — every existing client test's mocked exec() assertions get parameterized here).
- **After task 5:** `npm test -- folders client` green, plus the five-branch matrix from the
  risk table above explicitly present in the diff.
- **After task 6:** doctor-specific test green; manually run `node dist/cli/index.js doctor`
  locally against the real installed `himalaya 2.0.0` and confirm it reports v2/mailbox branch.
- **After task 7b:** `npm test -- cli-argv-smoke` green locally; confirm via `git diff` that no
  workflow YAML edit was needed (ci.yml's existing `npm test -- --run` already picks it up).
- **After task 8:** `grep -rn -- "--output json\|folder list" docs/ README.md` reviewed by hand
  — every remaining hit is an intentionally-labeled v1.x example, not a stale unlabeled one.
- **Final gate (task 9):** `npm test`, `npm run build`, `npm run build:bundle` all succeed;
  optional one-time `HIMALAYA_MCP_LIVE_TEST=1` run against the real account for pre-ship
  confidence (not required for the PR, per the spec's testing strategy).

## What's explicitly out of scope (per spec Boundaries)

- No retry-logic refactor in `client.ts` beyond what's needed for the version-detection failure
  path.
- No package version bump or release PR as part of this fix.
- No new runtime dependencies (confirmed: plain regex for version parsing, no semver library).
