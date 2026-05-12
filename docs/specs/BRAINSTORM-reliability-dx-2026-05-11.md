# BRAINSTORM: v1.6.0 Reliability & Diagnostics

**Created:** 2026-05-11
**Status:** approved → see [SPEC-v1.6.0-reliability-2026-05-11.md](./SPEC-v1.6.0-reliability-2026-05-11.md)
**Mode:** focused minor release (option B)

---

## Trigger

Live `himalaya-mcp doctor` run on 2026-05-11 surfaced:

- **14 passed, 2 warnings, 2 failed.**
- Failures: folder listing + envelope listing against default `unm` account ("Failed. Check IMAP connection.")
- Warnings: two stale plugin caches at `~/.claude/plugins/cache/{himalaya-mcp,local-plugins/himalaya-mcp}`.
- Integration plumbing is healthy: Desktop `.mcpb` enabled, Claude Code plugin symlinked from Homebrew Cellar, both binaries (`himalaya` v1.2.0, `himalaya-mcp` v1.5.0) on PATH.

The plumbing works; the diagnostic surface and account-aware error handling are thin.

---

## Decision Log (Q&A)

| # | Question | Answer | Implication |
|---|----------|--------|-------------|
| 1 | Is the `unm` IMAP failure an active problem? | **C — don't know** | Lead with diagnostics so the user can find out |
| 2 | Auth mix across accounts? | **A — all IMAP + password** | OAuth refresh helper out of scope |
| 3 | Latency / responsiveness pain? | **D — haven't used heavily enough** | Caching / persistent session work stays speculative |
| 4 | v1.6.0 ambition? | **B — focused minor, ~1 week** | Single theme: reliability |
| 5 | Deliverable? | **B — brainstorm + spec, both committed** | This file + SPEC- companion |

---

## Theme

**"Make health-checking and error-reporting account-aware and actionable."**

When something fails, the user (and Claude) should know *which* account, *why*, and *what to try next* — without leaving Claude.

---

## In Scope (v1.6.0)

### Quick Wins (~half-day)

- **W2 — `doctor --account <name>` flag.** Test a specific account instead of only the default. ~20 lines in `src/cli/setup.ts`.
- **W3 — Better IMAP failure messages.** When folder/envelope listing fails, include (a) account name, (b) raw himalaya stderr, (c) one suggested debug command (e.g., `himalaya envelope list -a <account>`).
- **W4 — `health_check` MCP tool.** Expose doctor functionality as a callable tool so Claude can self-diagnose when an email operation fails mid-conversation.
- **W5 — `docs/troubleshooting.md`.** Common IMAP failure modes: expired app passwords, cert pinning, IPv6/network restrictions, transient resets. Cross-linked from doctor output.

### Medium Effort (~3-4 days)

- **M1 — Multi-account doctor.** Iterate over all accounts in `~/.config/himalaya/config.toml`, render per-account status table (`reachable | last_error | hint`). Solves "default account broken → everything looks broken."
- **M2 — Structured error envelope.** Wrap himalaya failures as `{code, message, hint, account, recoverable}` instead of passing stderr through verbatim. Lets Claude suggest specific remediation (e.g., "re-authenticate account X") instead of relaying cryptic messages.
- **M3 — Retry + backoff for transients.** Detect `ECONNRESET`, timeout, `* BYE` patterns and auto-retry once with 200ms backoff before bubbling up. Eliminates spurious "broken" reports from network hiccups.

---

## Deferred / Out of Scope

| Item | Why deferred |
|------|--------------|
| OAuth refresh helper | Q2 answer: no OAuth accounts in use |
| `SPEC-installation-enhancement-2026-02-25` | Q4 answer: focused release; deserves its own spec review |
| Persistent IMAP session / IDLE | Q3 answer: latency not validated as pain point |
| SQLite envelope cache daemon | Same — needs heavier-usage evidence |
| Native `napi-rs` bindings to libhimalaya | v2.0 horizon; risky and dependent on upstream API stability |
| Local telemetry / event log | Useful but not core to "actionable diagnostics" theme |
| First-run MCP wizard prompt | Belongs with `SPEC-installation-enhancement` |

---

## Open Risks

1. **`unm` may be unrecoverable from the MCP side.** If the underlying himalaya config or account credentials are dead, no amount of better diagnostics will fix it — but W3+M1 will *tell us that clearly*, which is the v1.6.0 win.
2. **Structured error envelope (M2) requires a parsing layer over himalaya stderr.** himalaya error strings are not documented as stable; pattern matching may need updates when himalaya updates. Mitigation: keep the parser conservative — if no pattern matches, fall through to `{code: "unknown", message: <raw stderr>}`.
3. **Retry/backoff (M3) could mask real failures.** Mitigation: retry only once, only for explicitly-listed transient codes, and surface the retry attempt in the structured error envelope (`attempts: 2`).

---

## Recommended Sequencing

1. **First commit:** W3 + W5 (better error messages + troubleshooting docs). Lowest risk, immediately unblocks `unm` diagnosis.
2. **Second commit:** M1 + W2 (multi-account doctor + `--account` flag). Builds on W3.
3. **Third commit:** M2 (structured error envelope). Refactor — needs care.
4. **Fourth commit:** M3 (retry/backoff). Built on top of M2's error classification.
5. **Fifth commit:** W4 (health_check MCP tool). Wraps the above as an MCP-callable surface.

Five small commits → one PR `feature/v1.6.0-reliability` → dev → main.

---

## Success Criteria

- `himalaya-mcp doctor` reports per-account health, not just default
- Any email-tool failure surfaces account name + actionable hint via the structured envelope
- Transient IMAP errors auto-retry once before bubbling up
- All 414 existing tests pass; new tests cover M1, M2, M3, W2, W4
- `docs/troubleshooting.md` cross-linked from doctor output
- User can run `health_check` from inside Claude and learn whether `unm` is recoverable

---

## Next Steps

1. → Read companion SPEC: [SPEC-v1.6.0-reliability-2026-05-11.md](./SPEC-v1.6.0-reliability-2026-05-11.md)
2. → Create worktree: `git worktree add ~/.git-worktrees/himalaya-mcp/feature-v1.6.0-reliability -b feature/v1.6.0-reliability dev`
3. → Start with W3 (smallest change, highest immediate value)
