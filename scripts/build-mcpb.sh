#!/usr/bin/env bash
set -euo pipefail

# Build .mcpb Desktop Extension for Claude Desktop
# Usage: npm run build:mcpb

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MCPB_DIR="$PROJECT_ROOT/mcpb"
VERSION=$(node -p "require('$PROJECT_ROOT/package.json').version")

echo "==> Building himalaya-mcp v${VERSION} .mcpb bundle"

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

# mcpb pack outputs to CWD as <dirname>.mcpb — rename to versioned filename
OUTPUT_NAME="himalaya-mcp-v${VERSION}.mcpb"
MCPB_FILE="$PROJECT_ROOT/$OUTPUT_NAME"

# Check all possible output locations from mcpb pack
if [ -f "$MCPB_FILE" ]; then
  : # already in place
elif [ -f "$PROJECT_ROOT/mcpb.mcpb" ]; then
  mv "$PROJECT_ROOT/mcpb.mcpb" "$MCPB_FILE"
elif [ -f "$PROJECT_ROOT/himalaya-mcp-${VERSION}.mcpb" ]; then
  mv "$PROJECT_ROOT/himalaya-mcp-${VERSION}.mcpb" "$MCPB_FILE"
else
  # Last resort: find any .mcpb file that was just created
  FOUND=$(find "$PROJECT_ROOT" -maxdepth 1 -name "*.mcpb" -newer "$MCPB_DIR/manifest.json" 2>/dev/null | head -1)
  if [ -n "$FOUND" ]; then
    mv "$FOUND" "$MCPB_FILE"
  fi
fi

if [ -f "$MCPB_FILE" ]; then
  SIZE=$(wc -c < "$MCPB_FILE" | tr -d ' ')
  SIZE_KB=$((SIZE / 1024))
  echo ""
  echo "==> Built: $OUTPUT_NAME (${SIZE_KB} KB)"
  npx @anthropic-ai/mcpb info "$MCPB_FILE"
else
  echo "ERROR: No .mcpb file found after pack"
  exit 1
fi
