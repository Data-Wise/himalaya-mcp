#!/bin/bash
# Interactive Test Suite for: himalaya-mcp
# Type: Claude Code Plugin + MCP Server + CLI
# Generated: 2026-02-17
#
# Usage: bash tests/cli/interactive-tests.sh
# Requires: himalaya CLI configured with at least one account

set -uo pipefail

# ─── Colors ───────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PASS=0
FAIL=0
SKIP=0
TOTAL=0
TOTAL_TESTS=20

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

LOG_DIR="tests/cli/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/interactive-$(date +%Y%m%d-%H%M%S).log"

# ─── Test runner ──────────────────────────────────────────────────────

run_test() {
    local test_num="$1"
    local desc="$2"
    local expected="$3"
    local cmd="$4"

    TOTAL=$((TOTAL + 1))

    echo ""
    echo -e "${CYAN}── TEST $test_num/$TOTAL_TESTS: $desc ──${NC}"
    echo -e "${BOLD}Command:${NC}  $cmd"
    echo -e "${BOLD}Expected:${NC} $expected"
    echo ""
    echo -e "${BOLD}Actual output:${NC}"
    echo "─────────────────────────────────"

    local output
    output=$(eval "$cmd" 2>&1) || true
    echo "$output"
    echo "─────────────────────────────────"

    # Log
    {
        echo "TEST $test_num: $desc"
        echo "CMD: $cmd"
        echo "EXPECTED: $expected"
        echo "OUTPUT:"
        echo "$output"
        echo ""
    } >> "$LOG_FILE"

    echo ""
    echo -ne "  Pass? [${GREEN}y${NC}/${RED}n${NC}/${YELLOW}s${NC}kip/${RED}q${NC}uit] "
    read -r -n 1 answer
    echo ""

    case "$answer" in
        y|Y) PASS=$((PASS + 1)); echo -e "  ${GREEN}PASS${NC}" ;;
        n|N) FAIL=$((FAIL + 1)); echo -e "  ${RED}FAIL${NC}" ;;
        s|S) SKIP=$((SKIP + 1)); echo -e "  ${YELLOW}SKIP${NC}" ;;
        q|Q) print_summary; exit 0 ;;
        *)   SKIP=$((SKIP + 1)); echo -e "  ${YELLOW}SKIP${NC} (unrecognized)" ;;
    esac
}

print_summary() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
    echo -e "  ${GREEN}PASS: $PASS${NC}  ${RED}FAIL: $FAIL${NC}  ${YELLOW}SKIP: $SKIP${NC}  TOTAL: $TOTAL"
    echo -e "  Log: $LOG_FILE"
    echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
}

# ─── Prerequisite check ──────────────────────────────────────────────

echo -e "${BOLD}himalaya-mcp Interactive Test Suite${NC}"
echo -e "Tests: $TOTAL_TESTS | Log: $LOG_FILE"
echo ""

if ! command -v himalaya &>/dev/null; then
    echo -e "${RED}himalaya CLI not found. Install: brew install himalaya${NC}"
    echo -e "${YELLOW}Skipping live email tests.${NC}"
    HAS_HIMALAYA=false
else
    HAS_HIMALAYA=true
    echo -e "${GREEN}himalaya CLI found: $(which himalaya)${NC}"
fi

if [[ ! -f "dist/index.js" ]]; then
    echo -e "${YELLOW}dist/index.js not found. Run: npm run build:bundle${NC}"
fi

echo ""
echo -e "Press ${GREEN}Enter${NC} to start..."
read -r

# ═══════════════════════════════════════════════════════════════════════
# SECTION A: Setup CLI
# ═══════════════════════════════════════════════════════════════════════

run_test 1 \
    "Setup CLI: help output" \
    "Shows usage with setup, --check, --remove commands" \
    "node dist/cli/setup.js --help"

run_test 2 \
    "Setup CLI: unknown command" \
    "Shows usage/help for unrecognized argument" \
    "node dist/cli/setup.js badcommand"

run_test 3 \
    "Setup CLI: check (current state)" \
    "Either shows 'configured' with path or 'not configured'" \
    "node dist/cli/setup.js --check 2>&1 || true"

# ═══════════════════════════════════════════════════════════════════════
# SECTION B: MCP Server Startup
# ═══════════════════════════════════════════════════════════════════════

run_test 4 \
    "MCP server: responds to initialize" \
    "JSON-RPC response with serverInfo containing name 'himalaya-mcp'" \
    "echo '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{},\"clientInfo\":{\"name\":\"test\",\"version\":\"1.0\"}}}' | timeout 5 node dist/index.js 2>/dev/null | head -1 | python3 -m json.tool 2>/dev/null || echo '(parse the raw output above)'"

run_test 5 \
    "MCP server: lists tools" \
    "JSON response listing 19 tools (list_emails, read_email, etc.)" \
    "printf '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{},\"clientInfo\":{\"name\":\"test\",\"version\":\"1.0\"}}}\n{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/list\",\"params\":{}}' | timeout 5 node dist/index.js 2>/dev/null | tail -1 | python3 -c 'import json,sys; d=json.loads(sys.stdin.read()); print(f\"Tools: {len(d[\"result\"][\"tools\"])}\"); [print(f\"  - {t[\"name\"]}\") for t in d[\"result\"][\"tools\"]]' 2>/dev/null || echo '(check raw output)'"

run_test 6 \
    "MCP server: lists prompts" \
    "JSON response listing 4 prompts (triage_inbox, summarize_email, etc.)" \
    "printf '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{},\"clientInfo\":{\"name\":\"test\",\"version\":\"1.0\"}}}\n{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"prompts/list\",\"params\":{}}' | timeout 5 node dist/index.js 2>/dev/null | tail -1 | python3 -c 'import json,sys; d=json.loads(sys.stdin.read()); print(f\"Prompts: {len(d[\"result\"][\"prompts\"])}\"); [print(f\"  - {p[\"name\"]}\") for p in d[\"result\"][\"prompts\"]]' 2>/dev/null || echo '(check raw output)'"

run_test 7 \
    "MCP server: lists resources" \
    "JSON response listing 3 resource templates (email://inbox, etc.)" \
    "printf '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{},\"clientInfo\":{\"name\":\"test\",\"version\":\"1.0\"}}}\n{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"resources/list\",\"params\":{}}' | timeout 5 node dist/index.js 2>/dev/null | tail -1 | python3 -c 'import json,sys; d=json.loads(sys.stdin.read()); r=d[\"result\"]; items=r.get(\"resources\",[])+r.get(\"resourceTemplates\",[]); print(f\"Resources: {len(items)}\"); [print(f\"  - {i.get(\"uri\",i.get(\"uriTemplate\",\"?\"))}\") for i in items]' 2>/dev/null || echo '(check raw output)'"

# ═══════════════════════════════════════════════════════════════════════
# SECTION C: Live Email Tests (require himalaya)
# ═══════════════════════════════════════════════════════════════════════

if [[ "$HAS_HIMALAYA" == true ]]; then

    run_test 8 \
        "himalaya: list envelopes (JSON)" \
        "JSON array of email envelopes with id, from, subject fields" \
        "himalaya --output json envelope list --page-size 3 2>&1 | python3 -m json.tool 2>/dev/null | head -30"

    run_test 9 \
        "himalaya: list folders (JSON)" \
        "JSON array of folder objects with name field" \
        "himalaya --output json folder list 2>&1 | python3 -m json.tool 2>/dev/null | head -20"

    run_test 10 \
        "MCP: list_emails tool call" \
        "JSON-RPC response with email envelope data" \
        "printf '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{},\"clientInfo\":{\"name\":\"test\",\"version\":\"1.0\"}}}\n{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"list_emails\",\"arguments\":{\"page_size\":3}}}' | timeout 10 node dist/index.js 2>/dev/null | tail -1 | python3 -m json.tool 2>/dev/null | head -30 || echo '(check raw output)'"

    run_test 11 \
        "MCP: list_folders tool call" \
        "JSON-RPC response listing email folders" \
        "printf '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{},\"clientInfo\":{\"name\":\"test\",\"version\":\"1.0\"}}}\n{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"list_folders\",\"arguments\":{}}}' | timeout 10 node dist/index.js 2>/dev/null | tail -1 | python3 -m json.tool 2>/dev/null | head -20 || echo '(check raw output)'"

    run_test 12 \
        "MCP: search_emails tool call" \
        "JSON-RPC response with search results (may be empty)" \
        "printf '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{},\"clientInfo\":{\"name\":\"test\",\"version\":\"1.0\"}}}\n{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"search_emails\",\"arguments\":{\"query\":\"subject:test\"}}}' | timeout 10 node dist/index.js 2>/dev/null | tail -1 | python3 -m json.tool 2>/dev/null | head -20 || echo '(check raw output)'"

    run_test 13 \
        "MCP: read email://inbox resource" \
        "JSON-RPC response with inbox contents" \
        "printf '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{},\"clientInfo\":{\"name\":\"test\",\"version\":\"1.0\"}}}\n{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"resources/read\",\"params\":{\"uri\":\"email://inbox\"}}' | timeout 10 node dist/index.js 2>/dev/null | tail -1 | python3 -m json.tool 2>/dev/null | head -20 || echo '(check raw output)'"

    run_test 14 \
        "MCP: read email://folders resource" \
        "JSON-RPC response with folder list" \
        "printf '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{},\"clientInfo\":{\"name\":\"test\",\"version\":\"1.0\"}}}\n{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"resources/read\",\"params\":{\"uri\":\"email://folders\"}}' | timeout 10 node dist/index.js 2>/dev/null | tail -1 | python3 -m json.tool 2>/dev/null | head -20 || echo '(check raw output)'"

    run_test 15 \
        "MCP: compose_email preview (no send)" \
        "JSON-RPC response with email preview (confirm=false, NOT sent)" \
        "printf '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{},\"clientInfo\":{\"name\":\"test\",\"version\":\"1.0\"}}}\n{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"compose_email\",\"arguments\":{\"to\":\"test@example.com\",\"subject\":\"MCP Test\",\"body\":\"This is a test.\"}}}' | timeout 10 node dist/index.js 2>/dev/null | tail -1 | python3 -m json.tool 2>/dev/null | head -20 || echo '(check raw output)'"

    run_test 16 \
        "MCP: copy_to_clipboard" \
        "Copies text to clipboard. Verify with Cmd+V in any app." \
        "printf '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{},\"clientInfo\":{\"name\":\"test\",\"version\":\"1.0\"}}}\n{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"copy_to_clipboard\",\"arguments\":{\"text\":\"himalaya-mcp interactive test\"}}}' | timeout 5 node dist/index.js 2>/dev/null | tail -1 | python3 -m json.tool 2>/dev/null || echo '(check raw output)'"

else
    for i in $(seq 8 16); do
        TOTAL=$((TOTAL + 1))
        SKIP=$((SKIP + 1))
        echo -e "  ${YELLOW}SKIP${NC} Test $i (himalaya CLI not available)"
    done
fi

# ═══════════════════════════════════════════════════════════════════════
# SECTION D: Error Handling
# ═══════════════════════════════════════════════════════════════════════

run_test 17 \
    "MCP: invalid tool name" \
    "JSON-RPC error response (method not found or tool error)" \
    "printf '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{},\"clientInfo\":{\"name\":\"test\",\"version\":\"1.0\"}}}\n{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"nonexistent_tool\",\"arguments\":{}}}' | timeout 5 node dist/index.js 2>/dev/null | tail -1 | python3 -m json.tool 2>/dev/null || echo '(check raw output)'"

run_test 18 \
    "MCP: missing required args" \
    "Error response about missing 'id' parameter" \
    "printf '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{},\"clientInfo\":{\"name\":\"test\",\"version\":\"1.0\"}}}\n{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"read_email\",\"arguments\":{}}}' | timeout 5 node dist/index.js 2>/dev/null | tail -1 | python3 -m json.tool 2>/dev/null || echo '(check raw output)'"

# ═══════════════════════════════════════════════════════════════════════
# SECTION E: Homebrew Integration
# ═══════════════════════════════════════════════════════════════════════

if command -v brew &>/dev/null && brew list himalaya-mcp &>/dev/null 2>&1; then
    run_test 19 \
        "Homebrew: himalaya-mcp-install exists" \
        "Binary exists at /opt/homebrew/bin/himalaya-mcp-install" \
        "which himalaya-mcp-install && file \$(which himalaya-mcp-install)"

    run_test 20 \
        "Homebrew: himalaya-mcp setup from PATH" \
        "Shows usage when called from Homebrew-installed binary" \
        "himalaya-mcp --help 2>&1 || himalaya-mcp badcmd 2>&1 || true"
else
    TOTAL=$((TOTAL + 1)); SKIP=$((SKIP + 1))
    echo -e "  ${YELLOW}SKIP${NC} Test 19 (Homebrew not installed)"
    TOTAL=$((TOTAL + 1)); SKIP=$((SKIP + 1))
    echo -e "  ${YELLOW}SKIP${NC} Test 20 (Homebrew not installed)"
fi

# ═══════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════

print_summary
