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
npx @anthropic-ai/mcpb pack "$MCPB_DIR/"

# mcpb pack writes synchronously to <packed-dir-basename>.mcpb in the CWD
# (here: mcpb.mcpb, since we pack the "mcpb/" dir) — this is deterministic,
# not a naming fallback guess. The retry below exists only because GH Actions
# runners have occasionally shown a read-after-write visibility lag on this
# immediate stat check right after a large minify+zip (observed once in
# release CI, gone on retry with identical code/inputs — not reproducible
# locally). Retry, don't add more filename guesses.
OUTPUT_NAME="himalaya-mcp-v${VERSION}.mcpb"
MCPB_FILE="$PROJECT_ROOT/$OUTPUT_NAME"
PACKED_FILE="$PROJECT_ROOT/mcpb.mcpb"

FOUND=""
for attempt in 1 2 3 4 5; do
  if [ -f "$PACKED_FILE" ]; then
    FOUND="$PACKED_FILE"
    break
  fi
  sleep 0.5
done

if [ -n "$FOUND" ]; then
  mv "$FOUND" "$MCPB_FILE"
fi

if [ -f "$MCPB_FILE" ]; then
  SIZE=$(wc -c < "$MCPB_FILE" | tr -d ' ')
  SIZE_KB=$((SIZE / 1024))
  echo ""
  echo "==> Built: $OUTPUT_NAME (${SIZE_KB} KB)"
else
  echo "ERROR: No .mcpb file found after pack"
  exit 1
fi
