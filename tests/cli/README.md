# CLI Test Suites

## Automated Tests (CI-ready)

```bash
bash tests/cli/automated-tests.sh
```

Non-interactive. Validates plugin structure, build artifacts, version consistency, and runs vitest. Returns exit code 1 on any failure.

## Interactive Tests (QA)

```bash
bash tests/cli/interactive-tests.sh
```

Human-guided. Tests live MCP server, email operations (requires himalaya CLI), setup CLI, and Homebrew integration. Each test shows command output and asks you to judge pass/fail.

**Requires:** himalaya CLI with configured account for email tests (8-16).

## Logs

Interactive test runs are logged to `tests/cli/logs/` with timestamps.
