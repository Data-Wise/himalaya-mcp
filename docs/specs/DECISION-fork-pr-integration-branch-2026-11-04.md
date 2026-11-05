# Decision: land the external v2 write-path PR through an integration branch

**Status:** Accepted
**Date:** 2026-11-04
**Outcome:** #148 (external, from a fork) closed as superseded by #157 (`ee93812`).

## Context

#148 added the himalaya v2 write paths and `compose_email save_draft` (30 files, +1169/−238, three commits by the contributor and one by an AI agent). When reviewed:

- It came from a fork (`maintainerCanModify` was true) and CI had never run: fork workflows were waiting on maintainer approval (`action_required`).
- It conflicted with `dev` in `client.ts`, `read-raw.ts`, `tests/client.test.ts`, `CHANGELOG.md` and the plugin bundle, because #151 had since fixed the same read paths.
- It added dependencies (`nodemailer`, `postal-mime`) and a vitest-wide guard.

## Decision

Create a branch off `dev`, merge the PR's four commits into it (authorship preserved), resolve the conflicts, run the full suite and a live check, and open a new PR that supersedes #148. Squash with a `Co-authored-by:` trailer for each author taken from the commits (`git log --format='%an <%ae>'`), then close #148 with a thank-you comment.

## Alternatives considered

### Approve the fork's workflows and merge #148 as is
- Rejected: it runs unreviewed contributor code in the repository's workflows, and it could not merge cleanly anyway.

### Push a rebase to the contributor's fork branch
- Pro: keeps the PR open and the history theirs.
- Rejected: writes to someone else's repository; the conflicts needed judgment about two overlapping implementations.

### Ask the author to rebase
- Pro: no maintainer work.
- Rejected for now: slow, and the overlap with #151 was better resolved by the maintainers who had made those fixes.

## Consequences

- CI ran on code that the maintainers had reviewed and merged.
- The integration owner also owns verification. A live send test after the merge found a bug neither PR's mocked tests caught (#158: `draft_reply` returned an empty draft on v2).
- Credit lives in squash-commit trailers, not in the history. A trailer written from a guessed name or address is wrong; take names and addresses from the commits.
- A dependency advisory in the PR's dependencies surfaced during integration (`postal-mime` ^3, GHSA-f2hq-32vh-53cc) and was fixed in the same PR; see `DECISION-mcpb-zod-override-postal-mime-2026-11-04.md`.
