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
# `mcpb pack` ignores the output path it is handed and writes the archive under
# its own name — `himalaya-mcp-<version>.mcpb`, with no `v` prefix — into either
# the project root or the packed directory. So don't rely on the second
# argument; pack, then reconcile the filename ourselves.
#
# This previously used a sleep-and-retry loop globbing only $PROJECT_ROOT, which
# raced: it won on the v2.1.0 release and lost on v2.1.1, failing the build and
# skipping the entire Homebrew formula update. There is nothing to wait for once
# pack has exited — only a name to fix. See issue #121.
npx @anthropic-ai/mcpb pack "$MCPB_DIR/" "$MCPB_FILE"

if [ ! -f "$MCPB_FILE" ]; then
  shopt -s nullglob
  MCPB_OUTPUTS=("$PROJECT_ROOT"/himalaya-mcp*.mcpb "$MCPB_DIR"/himalaya-mcp*.mcpb)
  shopt -u nullglob

  if [ ${#MCPB_OUTPUTS[@]} -eq 0 ]; then
    echo "ERROR: pack produced no .mcpb file."
    echo "       Searched: $PROJECT_ROOT"
    echo "                 $MCPB_DIR"
    exit 1
  fi

  echo "  note: pack wrote $(basename "${MCPB_OUTPUTS[0]}") — renaming to $OUTPUT_NAME"
  mv "${MCPB_OUTPUTS[0]}" "$MCPB_FILE"
fi

SIZE=$(wc -c < "$MCPB_FILE" | tr -d ' ')
SIZE_KB=$((SIZE / 1024))
echo ""
echo "==> Built: $OUTPUT_NAME (${SIZE_KB} KB)"
