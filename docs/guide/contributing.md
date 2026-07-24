# Contributing

## Development Setup

```bash
git clone https://github.com/Data-Wise/himalaya-mcp.git
cd himalaya-mcp
npm install
npm run build              # TypeScript compilation
npm run build:bundle       # esbuild single-file bundle (~883KB)
npm test                   # Run all 575 tests
```

## Project Structure

```
src/                        # TypeScript source
  index.ts                  # MCP server entry point
  config.ts                 # Env-based configuration
  himalaya/                 # Subprocess wrapper + parsers
  tools/                    # 29 MCP tool handlers
  prompts/                  # 7 MCP prompt handlers
  resources/                # 3 MCP resource handlers
  adapters/                 # clipboard, calendar
tests/                      # 575 tests across 31 files
dist/                       # Build output
himalaya-mcp-plugin/        # Claude Code plugin definition
```

## Running Tests

```bash
npm test                    # Full suite, single run (vitest run)
npm run test:watch          # Watch mode for interactive dev
npx vitest tests/client.test.ts  # Single file
npx vitest -t "send_email"       # Single test name match
```

### Test structure

| Layer | Tests | What |
|-------|-------|------|
| Unit | parser, client, config, clipboard, errors, retry, accounts | Isolated module tests |
| Tool | manage, compose, compose-new, folders, attachments, calendar, actions, threads, health | Tool handler tests |
| Integration | prompts, morning | Prompt + prompt handler tests |
| Dogfood | dogfood, dogfood-reliability | Realistic Claude usage scenarios |
| E2E | setup, e2e | Full pipeline, .mcpb build, CLI commands |

### Writing tests

- Use `vi.mock` for subprocess calls (mock `execFile`)
- Test the structured error envelope for every failure path
- New tool handlers need unit tests + dogfood scenario
- Run `npm run build` before E2E tests (they spawn `dist/index.js`)

## Building

```bash
npm run build               # tsc — fast, for development
npm run build:bundle        # esbuild — single file, for distribution
npm run build:mcpb          # Package as .mcpb Desktop Extension
```

The esbuild bundle includes all dependencies in a single ~604KB file. This eliminates the 72MB `node_modules` requirement for distribution.

## Documentation

If you add or change a feature:

1. Update the corresponding doc (guide, tutorial, refcard, or reference)
2. Keep version numbers and counts in sync (tools, prompts, resources, skills, tests)
3. Run `mkdocs build --strict` to verify site builds
4. Run `markdownlint docs/` and `lychee --offline docs/` for quality

### Documentation inventory

| Doc | Purpose |
|-----|---------|
| `docs/index.md` | Landing page |
| `docs/getting-started/installation.md` | Setup guide |
| `docs/getting-started/quickstart.md` | 2-min quickstart |
| `docs/tutorials/` | 8 step-by-step tutorials (Level 1-3) |
| `docs/guide/guide.md` | Complete user guide |
| `docs/guide/workflows.md` | 20 workflow patterns |
| `docs/guide/cookbook.md` | 8 practical recipes |
| `docs/guide/security.md` | Security & privacy |
| `docs/guide/integrations.md` | External tool integration |
| `docs/guide/contributing.md` | This page |
| `docs/guide/troubleshooting.md` | Error reference |
| `docs/guide/packaging.md` | Distribution details |
| `docs/guide/skills.md` | Plugin skills reference |
| `docs/reference/commands.md` | Full command reference |
| `docs/reference/cheat-sheet.md` | Quick reference |
| `docs/reference/architecture.md` | System design |
| `docs/reference/desktop-extensions.md` | .mcpb format |

## Release Process

Releases are automated via CI. See the [Packaging Guide](packaging.md) for details.

1. Create a PR from `feature/*` to `dev`
2. After review and merge, create a PR from `dev` to `main`
3. Tag and GitHub Release triggers `homebrew-release.yml`
4. CI builds the bundle, attaches the .mcpb, updates the Homebrew formula

## Related

- [Code of Conduct](https://github.com/Data-Wise/himalaya-mcp/blob/main/CODE_OF_CONDUCT.md)
- [License](https://github.com/Data-Wise/himalaya-mcp/blob/main/LICENSE)
