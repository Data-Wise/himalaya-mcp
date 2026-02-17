#!/bin/bash
# Automated Test Suite for: himalaya-mcp
# Type: Claude Code Plugin + MCP Server + CLI
# Generated: 2026-02-17
#
# Usage: bash tests/cli/automated-tests.sh
# CI:    Add to .github/workflows/test.yml

set -euo pipefail

# ─── Colors ───────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PASS=0
FAIL=0
SKIP=0
TOTAL=0

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

# ─── Test helpers ─────────────────────────────────────────────────────

assert_pass() {
    local desc="$1"
    TOTAL=$((TOTAL + 1))
    PASS=$((PASS + 1))
    echo -e "  ${GREEN}PASS${NC} $desc"
}

assert_fail() {
    local desc="$1"
    local detail="${2:-}"
    TOTAL=$((TOTAL + 1))
    FAIL=$((FAIL + 1))
    echo -e "  ${RED}FAIL${NC} $desc"
    [[ -n "$detail" ]] && echo -e "       ${RED}$detail${NC}"
}

assert_skip() {
    local desc="$1"
    local reason="${2:-}"
    TOTAL=$((TOTAL + 1))
    SKIP=$((SKIP + 1))
    echo -e "  ${YELLOW}SKIP${NC} $desc ${reason:+($reason)}"
}

assert_file_exists() {
    local path="$1"
    local desc="${2:-$path exists}"
    if [[ -f "$path" ]]; then
        assert_pass "$desc"
    else
        assert_fail "$desc" "File not found: $path"
    fi
}

assert_dir_exists() {
    local path="$1"
    local desc="${2:-$path exists}"
    if [[ -d "$path" ]]; then
        assert_pass "$desc"
    else
        assert_fail "$desc" "Directory not found: $path"
    fi
}

assert_file_contains() {
    local path="$1"
    local pattern="$2"
    local desc="${3:-$path contains '$pattern'}"
    if grep -q "$pattern" "$path" 2>/dev/null; then
        assert_pass "$desc"
    else
        assert_fail "$desc" "Pattern not found in $path"
    fi
}

assert_json_valid() {
    local path="$1"
    local desc="${2:-$path is valid JSON}"
    if python3 -c "import json; json.load(open('$path'))" 2>/dev/null; then
        assert_pass "$desc"
    else
        assert_fail "$desc" "Invalid JSON"
    fi
}

assert_json_field() {
    local path="$1"
    local field="$2"
    local expected="$3"
    local desc="${4:-$path.$field == $expected}"
    local actual
    actual=$(python3 -c "import json; d=json.load(open('$path')); print(d.get('$field',''))" 2>/dev/null)
    if [[ "$actual" == "$expected" ]]; then
        assert_pass "$desc"
    else
        assert_fail "$desc" "Expected '$expected', got '$actual'"
    fi
}

assert_command_succeeds() {
    local desc="$1"
    shift
    if "$@" >/dev/null 2>&1; then
        assert_pass "$desc"
    else
        assert_fail "$desc" "Command failed: $*"
    fi
}

assert_command_output_contains() {
    local desc="$1"
    local pattern="$2"
    shift 2
    local output
    output=$("$@" 2>&1) || true
    if echo "$output" | grep -q "$pattern"; then
        assert_pass "$desc"
    else
        assert_fail "$desc" "Output missing '$pattern'"
    fi
}

section() {
    echo ""
    echo -e "${CYAN}── $1 ──${NC}"
}

# ═══════════════════════════════════════════════════════════════════════
# TESTS
# ═══════════════════════════════════════════════════════════════════════

section "1. Plugin Structure"

assert_file_exists "himalaya-mcp-plugin/.claude-plugin/plugin.json" "plugin.json exists"
assert_json_valid "himalaya-mcp-plugin/.claude-plugin/plugin.json" "plugin.json is valid JSON"
assert_json_field "himalaya-mcp-plugin/.claude-plugin/plugin.json" "name" "email" "plugin name is 'email'"
assert_json_field "himalaya-mcp-plugin/.claude-plugin/plugin.json" "version" "1.2.1" "plugin version is 1.2.1"

assert_file_exists ".claude-plugin/marketplace.json" "marketplace.json exists"
assert_json_valid ".claude-plugin/marketplace.json" "marketplace.json is valid JSON"

# Marketplace plugin name matches
MARKETPLACE_NAME=$(python3 -c "import json; d=json.load(open('.claude-plugin/marketplace.json')); print(d['plugins'][0]['name'])" 2>/dev/null)
if [[ "$MARKETPLACE_NAME" == "email" ]]; then
    assert_pass "marketplace plugin name is 'email'"
else
    assert_fail "marketplace plugin name is 'email'" "Got '$MARKETPLACE_NAME'"
fi

assert_file_exists ".mcp.json" "MCP server config exists"
assert_json_valid ".mcp.json" ".mcp.json is valid JSON"

# ───────────────────────────────────────────────────────────────────────

section "2. Plugin Directories"

assert_dir_exists "himalaya-mcp-plugin/skills" "skills/ directory"
assert_dir_exists "himalaya-mcp-plugin/agents" "agents/ directory"
assert_dir_exists "himalaya-mcp-plugin/hooks" "hooks/ directory"
assert_dir_exists "src/tools" "src/tools/ directory"
assert_dir_exists "src/prompts" "src/prompts/ directory"
assert_dir_exists "src/resources" "src/resources/ directory"
assert_dir_exists "src/adapters" "src/adapters/ directory"

# ───────────────────────────────────────────────────────────────────────

section "3. Skills (7 expected)"

SKILLS=(inbox triage digest reply compose attachments help)
SKILL_COUNT=$(ls himalaya-mcp-plugin/skills/*.md 2>/dev/null | wc -l | tr -d ' ')

if [[ "$SKILL_COUNT" -eq 7 ]]; then
    assert_pass "7 skill files found"
else
    assert_fail "7 skill files found" "Found $SKILL_COUNT"
fi

for skill in "${SKILLS[@]}"; do
    assert_file_exists "himalaya-mcp-plugin/skills/${skill}.md" "skill: ${skill}.md"
done

# Validate skill files are non-empty
for skill in "${SKILLS[@]}"; do
    local_file="himalaya-mcp-plugin/skills/${skill}.md"
    if [[ -s "$local_file" ]]; then
        assert_pass "${skill}.md is non-empty"
    else
        assert_fail "${skill}.md is non-empty" "File is empty"
    fi
done

# ───────────────────────────────────────────────────────────────────────

section "4. Agent"

assert_file_exists "himalaya-mcp-plugin/agents/email-assistant.md" "email-assistant agent"
if [[ -s "himalaya-mcp-plugin/agents/email-assistant.md" ]]; then
    assert_pass "email-assistant.md is non-empty"
else
    assert_fail "email-assistant.md is non-empty"
fi

# ───────────────────────────────────────────────────────────────────────

section "5. MCP Server Source (19 tools)"

TOOL_FILES=(inbox.ts read.ts manage.ts compose.ts compose-new.ts folders.ts attachments.ts calendar.ts actions.ts)
for tf in "${TOOL_FILES[@]}"; do
    assert_file_exists "src/tools/$tf" "tool source: $tf"
done

# Count registerTool calls
TOOL_COUNT=$(grep -r 'registerTool' src/tools/*.ts src/adapters/clipboard.ts 2>/dev/null | wc -l | tr -d ' ')
if [[ "$TOOL_COUNT" -eq 19 ]]; then
    assert_pass "19 registerTool calls found"
else
    assert_fail "19 registerTool calls found" "Found $TOOL_COUNT"
fi

# ───────────────────────────────────────────────────────────────────────

section "6. MCP Prompts (4 expected)"

PROMPT_FILES=(triage.ts summarize.ts digest.ts reply.ts)
for pf in "${PROMPT_FILES[@]}"; do
    assert_file_exists "src/prompts/$pf" "prompt source: $pf"
done

# ───────────────────────────────────────────────────────────────────────

section "7. MCP Resources"

assert_file_exists "src/resources/index.ts" "resources/index.ts"
assert_file_contains "src/resources/index.ts" "email://inbox" "inbox resource URI"
assert_file_contains "src/resources/index.ts" "email://folders" "folders resource URI"
assert_file_contains "src/resources/index.ts" "email://message" "message resource URI"

# ───────────────────────────────────────────────────────────────────────

section "8. Build Artifacts"

if [[ -f "dist/index.js" ]]; then
    assert_pass "dist/index.js exists (esbuild bundle)"
    # Check bundle size is reasonable (400KB-800KB)
    SIZE=$(wc -c < dist/index.js | tr -d ' ')
    if [[ "$SIZE" -gt 400000 && "$SIZE" -lt 800000 ]]; then
        assert_pass "bundle size reasonable ($(( SIZE / 1024 ))KB)"
    else
        assert_fail "bundle size reasonable" "Got $(( SIZE / 1024 ))KB"
    fi
else
    assert_skip "dist/index.js bundle" "Run npm run build:bundle first"
fi

if [[ -f "dist/cli/setup.js" ]]; then
    assert_pass "dist/cli/setup.js exists (tsc build)"
else
    assert_skip "dist/cli/setup.js" "Run npm run build first"
fi

# ───────────────────────────────────────────────────────────────────────

section "9. Setup CLI"

if [[ -f "dist/cli/setup.js" ]]; then
    assert_command_output_contains "setup --help shows usage" "Usage:" node dist/cli/setup.js --help
    assert_command_output_contains "setup --help mentions --check" "check" node dist/cli/setup.js --help
    assert_command_output_contains "setup --help mentions --remove" "remove" node dist/cli/setup.js --help
else
    assert_skip "setup CLI tests" "dist/cli/setup.js not built"
fi

# ───────────────────────────────────────────────────────────────────────

section "10. Package Metadata"

assert_file_exists "package.json" "package.json exists"
assert_json_valid "package.json" "package.json is valid JSON"
assert_json_field "package.json" "name" "himalaya-mcp" "npm package name"
assert_json_field "package.json" "version" "1.2.1" "npm package version"
assert_file_contains "package.json" '"type": "module"' "ESM module type"

# ───────────────────────────────────────────────────────────────────────

section "11. TypeScript Config"

assert_file_exists "tsconfig.json" "tsconfig.json exists"
assert_json_valid "tsconfig.json" "tsconfig.json is valid JSON"

# ───────────────────────────────────────────────────────────────────────

section "12. Documentation"

assert_file_exists "README.md" "README.md"
assert_file_exists "CLAUDE.md" "CLAUDE.md"
assert_file_exists "CHANGELOG.md" "CHANGELOG.md"
assert_file_exists "docs/index.md" "docs site index"
assert_file_exists "docs/getting-started/installation.md" "installation guide"
assert_file_exists "docs/reference/refcard.md" "reference card"

# ───────────────────────────────────────────────────────────────────────

section "13. Version Consistency"

PKG_VERSION=$(python3 -c "import json; print(json.load(open('package.json'))['version'])")
PLUGIN_VERSION=$(python3 -c "import json; print(json.load(open('himalaya-mcp-plugin/.claude-plugin/plugin.json'))['version'])")
MARKETPLACE_VERSION=$(python3 -c "import json; d=json.load(open('.claude-plugin/marketplace.json')); print(d['metadata']['version'])")

if [[ "$PKG_VERSION" == "$PLUGIN_VERSION" ]]; then
    assert_pass "package.json == plugin.json ($PKG_VERSION)"
else
    assert_fail "package.json == plugin.json" "$PKG_VERSION != $PLUGIN_VERSION"
fi

if [[ "$PKG_VERSION" == "$MARKETPLACE_VERSION" ]]; then
    assert_pass "package.json == marketplace.json ($PKG_VERSION)"
else
    assert_fail "package.json == marketplace.json" "$PKG_VERSION != $MARKETPLACE_VERSION"
fi

# Check src/index.ts VERSION constant
SRC_VERSION=$(grep 'VERSION' src/index.ts | head -1 | sed 's/.*"\(.*\)".*/\1/')
if [[ "$PKG_VERSION" == "$SRC_VERSION" ]]; then
    assert_pass "package.json == src/index.ts VERSION ($PKG_VERSION)"
else
    assert_fail "package.json == src/index.ts VERSION" "$PKG_VERSION != $SRC_VERSION"
fi

# ───────────────────────────────────────────────────────────────────────

section "14. Vitest Suite"

if command -v npx &>/dev/null; then
    echo -e "  ${CYAN}Running vitest...${NC}"
    if npx vitest run --reporter=verbose 2>&1 | tail -5 | grep -q "Tests.*passed"; then
        VITEST_RESULT=$(npx vitest run 2>&1 | grep "Tests" | tail -1)
        assert_pass "vitest: $VITEST_RESULT"
    else
        assert_fail "vitest suite passes" "See npm test output"
    fi
else
    assert_skip "vitest suite" "npx not available"
fi

# ═══════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "  ${GREEN}PASS: $PASS${NC}  ${RED}FAIL: $FAIL${NC}  ${YELLOW}SKIP: $SKIP${NC}  TOTAL: $TOTAL"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"

if [[ "$FAIL" -gt 0 ]]; then
    exit 1
fi
