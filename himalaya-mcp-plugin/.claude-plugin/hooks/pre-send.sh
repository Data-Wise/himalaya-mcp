#!/bin/bash
set -eo pipefail

# pre-send.sh — PreToolUse hook for email send safety gate
#
# Intercepts send_email and compose_email (with confirm=true) tool calls.
# Shows a preview of what's about to be sent, then allows the operation.
# The actual confirmation is handled by the MCP tool's two-phase safety gate.
#
# Input (stdin): JSON { tool_name, tool_input: { to, subject, body, confirm, ... } }
# Exit 0 = allow, 2 = block
#
# Install: Add to .claude/settings.json or project .claude/settings.local.json:
#   "PreToolUse": [{
#     "matcher": "mcp__plugin_email_himalaya",
#     "hooks": [{
#       "type": "command",
#       "command": "/bin/bash <plugin_path>/.claude-plugin/hooks/pre-send.sh",
#       "timeout": 5000
#     }]
#   }]

# Read JSON from stdin
INPUT="$(cat)"

# ---------------------------------------------------------------------------
# Extract fields using jq (fallback to python3)
# ---------------------------------------------------------------------------
_json_get() {
  local query="$1" json="$2"
  if command -v jq &>/dev/null; then
    printf '%s' "$json" | jq -r "$query // empty" 2>/dev/null || true
  elif command -v python3 &>/dev/null; then
    printf '%s' "$json" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    keys = '$query'.strip('.').split('.')
    for k in keys:
        d = d.get(k, '') if isinstance(d, dict) else ''
    print(d if d else '')
except: pass
" 2>/dev/null || true
  fi
}

TOOL_NAME="$(_json_get '.tool_name' "$INPUT")"

# Only intercept email send/compose tools
case "$TOOL_NAME" in
  *send_email*|*compose_email*)
    ;;
  *)
    exit 0
    ;;
esac

# Extract tool input fields
TOOL_INPUT="$(_json_get '.tool_input' "$INPUT")"
if [ -z "$TOOL_INPUT" ]; then
  exit 0
fi

TO="$(_json_get '.to' "$TOOL_INPUT")"
SUBJECT="$(_json_get '.subject' "$TOOL_INPUT")"
BODY="$(_json_get '.body' "$TOOL_INPUT")"
CONFIRM="$(_json_get '.confirm' "$TOOL_INPUT")"
CC="$(_json_get '.cc' "$TOOL_INPUT")"

# Only show preview when confirm=true (actual send attempt)
if [ "$CONFIRM" != "true" ]; then
  exit 0
fi

# Show preview on stderr (visible to user)
{
  echo ""
  echo "📧 ─── Email Send Preview ───────────────────────"
  echo "  To:      ${TO:-<not set>}"
  [ -n "$CC" ] && echo "  CC:      $CC"
  echo "  Subject: ${SUBJECT:-<not set>}"
  echo "  ─────────────────────────────────────────────"
  # Show first 3 lines of body
  if [ -n "$BODY" ]; then
    echo "$BODY" | head -3 | sed 's/^/  /'
    LINE_COUNT=$(echo "$BODY" | wc -l | tr -d ' ')
    if [ "$LINE_COUNT" -gt 3 ]; then
      echo "  ... ($LINE_COUNT lines total)"
    fi
  fi
  echo "  ─────────────────────────────────────────────"
  echo ""
} >&2

# Optional: append to sent log
LOG_DIR="${HOME}/.himalaya-mcp"
if [ -d "$LOG_DIR" ] || mkdir -p "$LOG_DIR" 2>/dev/null; then
  {
    echo "---"
    echo "date: $(date -Iseconds)"
    echo "to: $TO"
    echo "subject: $SUBJECT"
    echo "tool: $TOOL_NAME"
  } >> "$LOG_DIR/sent.log" 2>/dev/null || true
fi

# Allow the operation (MCP tool handles the actual safety gate)
exit 0
