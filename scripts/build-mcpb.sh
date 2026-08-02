#!/usr/bin/env bash
set -euo pipefail

# Build .mcpb Desktop Extension for Claude Desktop
# Usage: npm run build:mcpb

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MCPB_DIR="$PROJECT_ROOT/mcpb"
VERSION=$(node -p "require('$PROJECT_ROOT/package.json').version")

echo "==> Building himalaya-mcp v${VERSION} .mcpb bundle"

# Clear stale .mcpb output so the last-resort fallback below can't pick up a
# leftover file from a prior failed run.
rm -f "$PROJECT_ROOT"/*.mcpb

# Step 1: Build esbuild bundle
echo "  [1/4] Building esbuild bundle..."
npm run build:bundle --prefix "$PROJECT_ROOT"

# Step 2: Copy bundle into mcpb directory
echo "  [2/4] Copying dist/index.js to mcpb/dist/"
mkdir -p "$MCPB_DIR/dist"
cp "$PROJECT_ROOT/dist/index.js" "$MCPB_DIR/dist/index.js"

# Step 3: Validate manifest
echo "  [3/4] Validating manifest..."
npx --yes @anthropic-ai/mcpb validate "$MCPB_DIR/"

# Step 4: Pack .mcpb
echo "  [4/4] Packing .mcpb..."
OUTPUT_NAME="himalaya-mcp-v${VERSION}.mcpb"
MCPB_FILE="$PROJECT_ROOT/$OUTPUT_NAME"
npx @anthropic-ai/mcpb pack "$MCPB_DIR/" "$MCPB_FILE"

for _ in 1 2 3 4 5; do
  [ -f "$MCPB_FILE" ] && break

  shopt -s nullglob
  MCPB_OUTPUTS=("$PROJECT_ROOT"/himalaya-mcp*.mcpb)
  shopt -u nullglob
  if [ ${#MCPB_OUTPUTS[@]} -gt 0 ]; then
    mv "${MCPB_OUTPUTS[0]}" "$MCPB_FILE"
    break
  fi

  sleep 1
done

if [ -f "$MCPB_FILE" ]; then
  SIZE=$(wc -c < "$MCPB_FILE" | tr -d ' ')
  SIZE_KB=$((SIZE / 1024))
  echo ""
  echo "==> Built: $OUTPUT_NAME (${SIZE_KB} KB)"
else
  echo "ERROR: No .mcpb file found after pack"
  exit 1
fi
