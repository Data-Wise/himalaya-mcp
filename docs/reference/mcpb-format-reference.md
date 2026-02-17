# Claude Desktop Extensions (.mcpb) Technical Reference

**Last Updated:** 2026-02-16
**Spec Version:** manifest_version 0.3
**CLI Version:** @anthropic-ai/mcpb 2.1.2

---

## Table of Contents

1. [What Are .mcpb Files?](#1-what-are-mcpb-files)
2. [History: .dxt to .mcpb Rename](#2-history-dxt-to-mcpb-rename)
3. [Bundle Structure](#3-bundle-structure)
4. [manifest.json Schema](#4-manifestjson-schema)
5. [manifest_version History](#5-manifest_version-history)
6. [Server Configuration](#6-server-configuration)
7. [Template Variables](#7-template-variables)
8. [user_config Field Types](#8-user_config-field-types)
9. [Tools, Prompts, and Resources](#9-tools-prompts-and-resources)
10. [Compatibility](#10-compatibility)
11. [.mcpbignore Syntax](#11-mcpbignore-syntax)
12. [CLI Commands](#12-cli-commands)
13. [Signing and Verification](#13-signing-and-verification)
14. [Installation Mechanism](#14-installation-mechanism)
15. [Build Pipeline](#15-build-pipeline)
16. [Registry vs Local Installation](#16-registry-vs-local-installation)
17. [Localization](#17-localization)
18. [Real-World Examples](#18-real-world-examples)
19. [References](#19-references)

---

## 1. What Are .mcpb Files?

MCP Bundles (`.mcpb`) are ZIP archives containing a local MCP server and a `manifest.json` that describes the server and its capabilities. They are spiritually similar to Chrome extensions (`.crx`) or VS Code extensions (`.vsix`), enabling end users to install local MCP servers with a single click.

Key characteristics:

- **Format:** Standard ZIP archive with `.mcpb` extension
- **Required file:** Only `manifest.json` is mandatory
- **Transports:** stdio (standard input/output between Claude and the server)
- **Runtimes:** Node.js (recommended, ships with Claude Desktop), Python, UV (experimental), or standalone binaries
- **Platforms:** macOS (darwin), Windows (win32), Linux (linux)
- **Package:** `@anthropic-ai/mcpb` on npm

The format is open-source and designed for cross-client adoption. Any AI desktop application can support .mcpb bundles, not just Claude Desktop.

---

## 2. History: .dxt to .mcpb Rename

### Timeline

| Date | Event |
|------|-------|
| ~Mid 2025 | Anthropic introduces Desktop Extensions with `.dxt` file format |
| 2025-09-11 | Format renamed from `.dxt` to `.mcpb` (MCP Bundle) |
| 2025-11-20 | Format moved to Model Context Protocol open-source project |
| Current | `@anthropic-ai/mcpb` CLI v2.1.2, manifest_version 0.3 |

### What Changed

| Before | After |
|--------|-------|
| `.dxt` file extension | `.mcpb` file extension |
| `@anthropic-ai/dxt` npm package | `@anthropic-ai/mcpb` npm package |
| `dxt` CLI command | `mcpb` CLI command |
| `dxt_version` manifest field | `manifest_version` manifest field |
| Anthropic-internal spec | Open-source at `modelcontextprotocol/mcpb` |

### What Stayed the Same

- All functionality, schema fields, and capabilities are identical
- Existing `.dxt` files continue to work in Claude Desktop
- Same ZIP-based archive format
- Same installation UX (double-click, drag-and-drop, menu install)

### Migration

This was a naming change only. The `dxt_version` field in older manifests is still accepted. New extensions should use `manifest_version` and the `.mcpb` extension.

---

## 3. Bundle Structure

### Minimal Bundle (manifest only)

```
my-server.mcpb (ZIP)
└── manifest.json          # Required: metadata + server config
```

### Node.js Bundle

```
my-server.mcpb (ZIP)
├── manifest.json          # Required
├── dist/
│   └── index.js           # Bundled server (esbuild/webpack)
├── node_modules/          # Or bundle deps into index.js
├── icon.png               # Optional: 512x512 recommended, 256x256 minimum
└── assets/                # Optional: screenshots, icons
```

### Python Bundle

```
my-server.mcpb (ZIP)
├── manifest.json
├── server/
│   ├── main.py
│   └── utils.py
├── lib/                   # Bundled pip packages
└── requirements.txt
```

### Binary Bundle

```
my-server.mcpb (ZIP)
├── manifest.json
├── server/
│   ├── my-server          # Unix executable
│   └── my-server.exe      # Windows executable
└── icon.png
```

### UV Bundle (Experimental, v0.4+)

```
my-server.mcpb (ZIP)
├── manifest.json          # server.type = "uv"
├── server/
│   └── main.py
└── pyproject.toml         # Dependencies (no bundled packages needed)
```

---

## 4. manifest.json Schema

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `manifest_version` | `string` | Spec version. Current: `"0.3"`. Legacy: `dxt_version` still accepted. |
| `name` | `string` | Machine-readable identifier for CLI/APIs |
| `version` | `string` | Semantic version (e.g., `"1.2.1"`) |
| `description` | `string` | Brief description (localizable) |
| `author` | `object` | `{ name: string (required), email?: string, url?: string }` |
| `server` | `object` | Server configuration (see [Section 6](#6-server-configuration)) |

### Optional Display & Metadata Fields

| Field | Type | Description |
|-------|------|-------------|
| `display_name` | `string` | Human-friendly name for UI (localizable) |
| `long_description` | `string` | Detailed markdown description (localizable) |
| `icon` | `string` | Path to PNG icon or HTTPS URL |
| `icons` | `array` | Icon variants: `[{ src, size, theme? }]` |
| `screenshots` | `array` | Screenshot image paths |
| `keywords` | `array<string>` | Search/discovery keywords (localizable) |
| `license` | `string` | License identifier (e.g., `"MIT"`) |

### Optional Link Fields

| Field | Type | Description |
|-------|------|-------------|
| `repository` | `object` | `{ type: "git", url: string }` |
| `homepage` | `string` | Homepage URL |
| `documentation` | `string` | Documentation URL |
| `support` | `string` | Support/issues URL |

### Optional Feature Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `tools` | `array` | `[]` | Static tool declarations |
| `tools_generated` | `boolean` | `false` | Server generates additional tools at runtime |
| `prompts` | `array` | `[]` | Static prompt declarations |
| `prompts_generated` | `boolean` | `false` | Server generates additional prompts at runtime |
| `resources_generated` | `boolean` | `false` | Server generates resources at runtime |

### Optional Configuration Fields

| Field | Type | Description |
|-------|------|-------------|
| `user_config` | `object` | User-configurable fields (see [Section 8](#8-user_config-field-types)) |
| `compatibility` | `object` | Platform/runtime requirements (see [Section 10](#10-compatibility)) |
| `localization` | `object` | Locale resources config (see [Section 17](#17-localization)) |
| `privacy_policies` | `array<string>` | URLs to privacy policies for external services |
| `_meta` | `object` | Platform-specific metadata (reverse-DNS keys) |

### Icons Array Schema

```json
"icons": [
  { "src": "assets/icon-16-light.png", "size": "16x16", "theme": "light" },
  { "src": "assets/icon-16-dark.png",  "size": "16x16", "theme": "dark" },
  { "src": "assets/icon-512.png",      "size": "512x512" }
]
```

- `src` (string, required): Path relative to bundle root
- `size` (string, required): Format `"WxH"` (e.g., `"16x16"`, `"512x512"`)
- `theme` (string, optional): `"light"` or `"dark"`

---

## 5. manifest_version History

| Version | Key Name | Notes |
|---------|----------|-------|
| `"0.1"` | `dxt_version` | Original release. Used by early .dxt extensions. Still accepted by Claude Desktop for backward compatibility. |
| `"0.2"` | `manifest_version` | Introduced `manifest_version` field name (replacing `dxt_version`). Used by Anthropic's Filesystem extension. |
| `"0.3"` | `manifest_version` | Current version. Adds `resources_generated`, `long_description`, `privacy_policies`, `_meta`, expanded `user_config` types, `localization` support. Used by Anthropic's PowerPoint, Word extensions and third-party extensions. |

The version field is intentionally low ("we are looking forward to working with the greater community on evolving and changing the format"). Extensions using `dxt_version: "0.1"` continue to work without modification.

---

## 6. Server Configuration

```json
"server": {
  "type": "node",
  "entry_point": "dist/index.js",
  "mcp_config": {
    "command": "node",
    "args": ["${__dirname}/dist/index.js"],
    "env": {
      "API_KEY": "${user_config.api_key}",
      "HOME": "${HOME}"
    }
  }
}
```

### Server Types

| Type | Runtime | Notes |
|------|---------|-------|
| `"node"` | Node.js | **Recommended.** Node.js ships with Claude Desktop. |
| `"python"` | Python | Must bundle deps in `lib/` or `venv/`. Cannot portably bundle compiled deps (e.g., pydantic). |
| `"uv"` | UV (experimental, v0.4+) | Uses `pyproject.toml` for deps. Host manages Python and deps automatically. |
| `"binary"` | Standalone executable | Static linking preferred. Include platform-specific binaries. |

### mcp_config Fields

| Field | Type | Description |
|-------|------|-------------|
| `command` | `string` | Executable to run (e.g., `"node"`, `"python3"`, `"${__dirname}/server/my-binary"`) |
| `args` | `array<string>` | Command arguments. Supports `${__dirname}` and `${user_config.*}` substitution. |
| `env` | `object` | Environment variables. Supports `${user_config.*}`, `${HOME}`, `${__dirname}` substitution. |

### Entry Point

The `entry_point` field specifies the main server file relative to the bundle root. It serves as documentation and for validation; the actual execution is determined by `mcp_config.command` and `mcp_config.args`.

---

## 7. Template Variables

Template variables use `${variable}` syntax and are resolved at runtime by Claude Desktop when launching the MCP server.

| Variable | Expands To | Usable In |
|----------|------------|-----------|
| `${__dirname}` | Absolute path to the extension's installation directory | `mcp_config.args`, `mcp_config.env` |
| `${user_config.<key>}` | Value the user entered for the named config field | `mcp_config.args`, `mcp_config.env` |
| `${HOME}` | User's home directory (e.g., `/Users/dt`) | `mcp_config.env`, `user_config[].default` |
| `${arguments.<name>}` | Prompt argument value (for prompts only) | `prompts[].text` |

### Examples

```json
"args": ["${__dirname}/dist/index.js"]
// Resolves to: /Users/dt/Library/Application Support/Claude/Claude Extensions/my-ext/dist/index.js

"env": {
  "BINARY": "${user_config.binary_path}",
  "ACCOUNT": "${user_config.account_name}"
}
// Resolves to user-provided values from the settings UI

"default": ["${HOME}/Desktop"]
// Resolves to: /Users/dt/Desktop
```

### Behavior with Empty Optional Config

When a `user_config` field is optional and the user leaves it empty, the variable resolves to an empty string `""`. Server code should handle this gracefully (e.g., fall back to defaults when the env var is empty).

---

## 8. user_config Field Types

The `user_config` object defines fields that Claude Desktop renders as a settings UI. Users must fill in required fields before the extension activates. Sensitive values are stored in the OS keychain.

### Field Types

#### `string` - Text Input

```json
"api_key": {
  "type": "string",
  "title": "API Key",
  "description": "Your API key for the service",
  "sensitive": true,
  "required": true
}
```

```json
"account_name": {
  "type": "string",
  "title": "Account Name",
  "description": "Default account to use",
  "default": "personal",
  "required": false
}
```

#### `number` - Numeric Input

```json
"max_file_size": {
  "type": "number",
  "title": "Maximum File Size (MB)",
  "description": "Maximum file size to process",
  "default": 10,
  "min": 1,
  "max": 100,
  "required": false
}
```

#### `boolean` - Toggle

```json
"verbose_logging": {
  "type": "boolean",
  "title": "Verbose Logging",
  "description": "Enable detailed logging output",
  "default": false
}
```

#### `file` - File Path Picker

```json
"binary_path": {
  "type": "file",
  "title": "Binary Path",
  "description": "Path to the CLI binary",
  "required": false
}
```

#### `directory` - Directory Path Picker

```json
"allowed_directories": {
  "type": "directory",
  "title": "Allowed Directories",
  "description": "Directories the server can access",
  "multiple": true,
  "required": true,
  "default": ["${HOME}/Desktop"]
}
```

### Common Properties (All Types)

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `type` | `string` | (required) | One of: `"string"`, `"number"`, `"boolean"`, `"file"`, `"directory"` |
| `title` | `string` | - | UI label displayed to the user |
| `description` | `string` | - | Help text / tooltip |
| `required` | `boolean` | `false` | Whether the user must provide a value before the extension activates |
| `default` | `varies` | - | Default value (type must match field type) |
| `sensitive` | `boolean` | `false` | If true, value is masked in UI and stored in OS keychain |
| `multiple` | `boolean` | `false` | If true, allows multiple values (renders as array). Applies to `file`, `directory`, `string`. |

### Number-Specific Properties

| Property | Type | Description |
|----------|------|-------------|
| `min` | `number` | Minimum allowed value |
| `max` | `number` | Maximum allowed value |

### Sensitive Data Handling

When `sensitive: true`:
- The value is masked (dots/asterisks) in the settings UI
- The value is stored in the OS keychain (macOS Keychain, Windows Credential Manager)
- The value is never written to disk in plaintext
- The value is injected via environment variable at server launch time

---

## 9. Tools, Prompts, and Resources

### Static Tool Declaration

```json
"tools": [
  {
    "name": "search_files",
    "description": "Search for files in a directory"
  },
  {
    "name": "read_file",
    "description": "Read the contents of a file"
  }
]
```

Each tool object has:
- `name` (string, required): Tool identifier
- `description` (string, required, localizable): What the tool does

Tool declarations serve as metadata for the extension directory/marketplace. The actual tool schemas (parameters, return types) are defined in the MCP server code and discovered via the MCP `tools/list` method at runtime.

### Static Prompt Declaration

```json
"prompts": [
  {
    "name": "triage_inbox",
    "description": "Classify emails as actionable, FYI, or skip",
    "arguments": ["count"],
    "text": "Triage my recent emails. For each, classify as Actionable, FYI, or Skip."
  }
]
```

Each prompt object has:
- `name` (string, required): Prompt identifier
- `description` (string, required, localizable): What the prompt does
- `arguments` (array<string>, optional): Named arguments
- `text` (string, optional): Template text (supports `${arguments.<name>}`)

### Dynamic Generation Flags

| Flag | Default | Effect |
|------|---------|--------|
| `tools_generated` | `false` | When `true`, tells the client that the server may register additional tools at runtime beyond those listed in `tools[]`. Client should call `tools/list` to discover all tools. |
| `prompts_generated` | `false` | When `true`, server may register additional prompts at runtime. Client should call `prompts/list`. |
| `resources_generated` | `false` | When `true`, server provides resources at runtime. Client should call `resources/list`. |

These flags do NOT replace static declarations. Use both: static declarations for the marketplace/directory, and `*_generated: true` if the server also creates tools/prompts/resources dynamically.

---

## 10. Compatibility

```json
"compatibility": {
  "claude_desktop": ">=1.0.0",
  "platforms": ["darwin", "win32"],
  "runtimes": {
    "node": ">=22.0.0"
  }
}
```

### Client Version Constraints

Any key in `compatibility` (other than `platforms` and `runtimes`) is treated as a client name with a semver constraint:

```json
"claude_desktop": ">=1.0.0",
"my_client": ">1.0.0",
"other_client": ">=2.0.0 <3.0.0"
```

Supported semver patterns: `>=`, `>`, `<`, `<=`, `^`, `~`, ranges with spaces.

### Platform Values

| Value | Platform |
|-------|----------|
| `"darwin"` | macOS |
| `"win32"` | Windows |
| `"linux"` | Linux |

Maps to Node.js `process.platform` values.

### Runtime Constraints

Only specify the runtimes your extension actually uses:

```json
"runtimes": {
  "node": ">=16.0.0"      // For Node.js servers
}
```

```json
"runtimes": {
  "python": ">=3.8"       // For Python servers
}
```

---

## 11. .mcpbignore Syntax

Create a `.mcpbignore` file in your bundle directory to exclude files from the packed `.mcpb` archive. The syntax is similar to `.gitignore`.

### Default Exclusions (Always Applied)

The `mcpb pack` command automatically excludes:

```
.DS_Store
Thumbs.db
.gitignore
.git/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.npm/
.npmrc
.yarnrc
.yarn/
.pnp.*
node_modules/.cache/
node_modules/.bin/
*.map
.env.local
.env.*.local
package-lock.json
yarn.lock
```

### Custom .mcpbignore Example

```gitignore
# Comments start with #
# Empty lines are ignored

# Test files
*.test.js
*.test.ts
*.spec.js
__tests__/
coverage/

# Source (if bundling to dist/)
src/
tsconfig.json

# Dev dependencies
.eslintrc*
.prettierrc*
vitest.config.*

# Documentation
docs/
*.md
!README.md

# Environment
.env*
temp/
```

### Supported Patterns

| Pattern | Meaning |
|---------|---------|
| `filename.txt` | Exact filename match |
| `*.log` | Simple glob (any .log file) |
| `temp/*` | Everything inside temp/ |
| `docs/` | Entire directory |
| `**/*.test.ts` | Recursive glob |
| `# comment` | Comment line (ignored) |
| (empty line) | Ignored |

---

## 12. CLI Commands

Install: `npm install -g @anthropic-ai/mcpb`

Or use via npx: `npx @anthropic-ai/mcpb <command>`

### mcpb init [directory]

Creates a new manifest.json interactively.

```bash
mcpb init                    # Current directory
mcpb init my-extension/      # Specific directory
```

Prompts for: name, author, display name, version, description, server type, entry point, tools, keywords, license, repository.

### mcpb validate \<path\>

Validates manifest.json against the schema.

```bash
mcpb validate manifest.json       # Direct file path
mcpb validate ./my-extension      # Directory containing manifest.json
mcpb validate .                   # Current directory
```

Returns success or lists validation errors.

### mcpb pack [directory] [output]

Packs a directory into a .mcpb file. Validates manifest first, excludes dev files, applies .mcpbignore, creates ZIP with maximum compression.

```bash
mcpb pack .                                    # Pack current dir
mcpb pack my-extension/                        # Pack specific dir
mcpb pack my-extension/ my-ext-v1.0.mcpb       # Custom output name
```

### mcpb clean \<mcpb\>

Cleans an existing .mcpb file: validates the manifest, removes unnecessary files, and minimizes bundle size.

```bash
mcpb clean my-extension.mcpb
```

### mcpb unpack \<mcpb-file\> [output]

Extracts a .mcpb file to a directory.

```bash
mcpb unpack my-extension.mcpb                  # Extract to current dir
mcpb unpack my-extension.mcpb ./extracted/     # Extract to specific dir
```

### mcpb info \<mcpb-file\>

Displays metadata about a packed .mcpb file: name, version, description, file size, signature status, certificate details.

```bash
mcpb info my-extension.mcpb
```

### mcpb sign \<mcpb-file\>

Signs a .mcpb file with a certificate.

```bash
mcpb sign my-ext.mcpb                                    # Default cert.pem/key.pem
mcpb sign my-ext.mcpb --cert /path/cert.pem --key /path/key.pem
mcpb sign my-ext.mcpb --self-signed                      # Generate self-signed cert
mcpb sign my-ext.mcpb --cert c.pem --key k.pem --intermediate inter.pem root.pem
```

Options:
- `--cert, -c` : Certificate file path (PEM format, default: `cert.pem`)
- `--key, -k` : Private key file path (PEM format, default: `key.pem`)
- `--intermediate, -i` : Intermediate certificate file paths
- `--self-signed` : Create and use a self-signed certificate

### mcpb verify \<mcpb-file\>

Verifies the signature of a signed .mcpb file.

```bash
mcpb verify my-extension.mcpb
```

Output includes: signature validity, certificate subject/issuer, validity dates, fingerprint, self-signed warning.

### mcpb unsign \<mcpb-file\>

Removes the signature block from a .mcpb file (for development/testing).

```bash
mcpb unsign my-extension.mcpb
```

---

## 13. Signing and Verification

### Signature Format

MCPB uses PKCS#7 (Cryptographic Message Syntax) for digital signatures. The signature is appended to the ZIP content with boundary markers:

```
[Original MCPB ZIP content]
MCPB_SIG_V1
[Base64-encoded PKCS#7 signature]
MCPB_SIG_END
```

This design provides:
- **Backward compatibility:** Unsigned .mcpb files are valid ZIP files
- **Non-destructive:** Original ZIP content is unmodified
- **Detached format:** Signature can be added/removed independently

### Certificate Requirements

For signing, you need:

1. **Certificate:** X.509 in PEM format, ideally with Code Signing extended key usage
2. **Private Key:** Corresponding private key in PEM format
3. **Intermediate Certificates** (optional): For CA-issued certificates, required for chain validation

### Signing Tiers

| Tier | Command | Trust Level |
|------|---------|-------------|
| Unsigned | (no signing) | Lowest. User must manually approve. |
| Self-signed | `mcpb sign --self-signed` | Development/testing only. Warns user. |
| CA-signed | `mcpb sign --cert ... --key ...` | Production. Full trust chain. |

---

## 14. Installation Mechanism

### Installation Methods

1. **Double-click** the `.mcpb` file (file association with Claude Desktop)
2. **Drag-and-drop** the `.mcpb` file into the Claude Desktop window
3. **Menu:** Developer > Extensions > Install Extension

All methods open a review UI where the user can see the extension name, description, author, tools, and configure `user_config` fields.

### On-Disk Layout (macOS)

```
~/Library/Application Support/Claude/
├── Claude Extensions/                          # Extracted extensions
│   ├── my-extension/
│   │   ├── manifest.json
│   │   ├── dist/
│   │   │   └── index.js
│   │   └── icon.png
│   ├── ant.dir.ant.anthropic.filesystem/       # Anthropic first-party
│   │   ├── manifest.json
│   │   ├── server/
│   │   │   └── index.js
│   │   ├── node_modules/
│   │   └── icon.png
│   └── context7/                               # Third-party
│       ├── manifest.json
│       ├── dist/
│       │   └── index.js
│       └── icon.png
├── Claude Extensions Settings/                 # Per-extension settings
│   ├── my-extension.json                       # { isEnabled, userConfig }
│   ├── ant.dir.ant.anthropic.filesystem.json
│   └── context7.json
├── extensions-installations.json               # Installation registry
└── extensions-blocklist.json                   # Enterprise blocklist
```

### Extension Settings File Format

Each extension gets a settings file in `Claude Extensions Settings/`:

```json
{
  "isEnabled": true,
  "userConfig": {
    "allowed_directories": [
      "/Users/dt/projects",
      "/Users/dt/.config"
    ]
  }
}
```

- `isEnabled` (boolean): Whether the extension is currently active
- `userConfig` (object): User-provided values for `user_config` fields

When an extension has no user config, the file is minimal:

```json
{
  "isEnabled": true
}
```

### Extensions Blocklist

Enterprise administrators can push blocklists:

```json
[
  {
    "entries": [],
    "lastUpdated": "2026-02-17T06:35:51.435Z",
    "url": "https://claude.ai/api/organizations/{org_id}/dxt/blocklist"
  }
]
```

### Naming Conventions

| Source | Directory Name Pattern | Example |
|--------|----------------------|---------|
| Anthropic first-party | `ant.dir.ant.anthropic.<name>` | `ant.dir.ant.anthropic.filesystem` |
| GitHub third-party | `ant.dir.gh.<user>.<repo>` | `ant.dir.gh.k6l3.osascript` |
| Local / manual | Extension `name` field | `himalaya-mcp`, `context7` |

---

## 15. Build Pipeline

### Typical Build Steps

```
Source Code (TypeScript/JS)
    |
    v
[1] esbuild / webpack / tsc
    |  Produces: dist/index.js (single-file bundle)
    v
[2] Copy artifacts to mcpb/ staging directory
    |  Copy: dist/index.js -> mcpb/dist/index.js
    |  Already present: mcpb/manifest.json
    v
[3] mcpb validate mcpb/
    |  Validates manifest.json against schema
    v
[4] mcpb pack mcpb/
    |  Creates: my-extension.mcpb (ZIP)
    |  Applies: default exclusions + .mcpbignore
    v
[5] mcpb sign my-extension.mcpb (optional)
    |  Appends PKCS#7 signature
    v
[6] mcpb info my-extension.mcpb
       Verify metadata, size, signature status
```

### Example build-mcpb.sh

```bash
#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MCPB_DIR="$PROJECT_ROOT/mcpb"
VERSION=$(node -p "require('$PROJECT_ROOT/package.json').version")

echo "==> Building v${VERSION} .mcpb bundle"

# Step 1: Build esbuild bundle
npm run build:bundle --prefix "$PROJECT_ROOT"

# Step 2: Copy into mcpb staging directory
mkdir -p "$MCPB_DIR/dist"
cp "$PROJECT_ROOT/dist/index.js" "$MCPB_DIR/dist/index.js"

# Step 3: Validate manifest
npx @anthropic-ai/mcpb validate "$MCPB_DIR/"

# Step 4: Pack
npx @anthropic-ai/mcpb pack "$MCPB_DIR/"

# Step 5: Rename to versioned filename
mv "$PROJECT_ROOT/mcpb.mcpb" "$PROJECT_ROOT/my-ext-v${VERSION}.mcpb"

# Step 6: Info
npx @anthropic-ai/mcpb info "$PROJECT_ROOT/my-ext-v${VERSION}.mcpb"
```

### package.json Script

```json
{
  "scripts": {
    "build:bundle": "esbuild src/index.ts --bundle --platform=node --format=esm --outfile=dist/index.js",
    "build:mcpb": "bash scripts/build-mcpb.sh"
  }
}
```

### CI Integration (GitHub Actions)

```yaml
- name: Validate MCPB manifest
  run: npx @anthropic-ai/mcpb validate mcpb/

- name: Build MCPB bundle
  run: npm run build:mcpb

- name: Verify MCPB bundle
  run: npx @anthropic-ai/mcpb info my-ext-v*.mcpb

- name: Upload MCPB artifact
  uses: actions/upload-artifact@v4
  with:
    name: mcpb-bundle
    path: "*.mcpb"
```

---

## 16. Registry vs Local Installation

### Local Installation

- Double-click a `.mcpb` file downloaded from GitHub Releases, website, etc.
- File is extracted to `~/Library/Application Support/Claude/Claude Extensions/<name>/`
- Settings stored locally in `Claude Extensions Settings/<name>.json`
- No automatic updates (manual download of new versions)

### Directory / Registry

- Claude Desktop has a built-in extension directory (accessible from the app)
- Extensions submitted to the directory get broader visibility
- Supports automatic updates
- Enterprise features: blocklisting, pre-installation via MDM/Group Policy

### Enterprise Deployment

| Feature | macOS | Windows |
|---------|-------|---------|
| Pre-install approved extensions | MDM profiles | Group Policy |
| Block specific extensions | Blocklist URL | Group Policy |
| Block specific publishers | Blocklist URL | Group Policy |
| Disable all extensions | MDM | Group Policy |
| Private extension directory | Custom URL | Custom URL |

---

## 17. Localization

Extensions can provide translations for localizable fields (marked with a globe icon in the schema).

### Configuration

```json
"localization": {
  "resources": "mcpb-resources/${locale}.json",
  "default_locale": "en-US"
}
```

- `resources`: Path template with `${locale}` placeholder (default: `"mcpb-resources/${locale}.json"`)
- `default_locale`: BCP 47 locale tag (default: `"en-US"`)

### Locale File Format

`mcpb-resources/es-ES.json`:
```json
{
  "description": "Servidor de email con privacidad",
  "display_name": "Email Himalaya",
  "tools": {
    "list_emails": {
      "description": "Listar correos en una carpeta"
    }
  }
}
```

### Localizable Fields

- `description`, `display_name`, `long_description`
- `author.name`
- `tools[].description`
- `prompts[].description`
- `keywords`

### Fallback Chain

The client applies locale fallbacks: `es-UY` -> `es-MX` -> `es-ES` -> `en-US` (default).

---

## 18. Real-World Examples

### Minimal: Context7 (dxt_version 0.1, third-party)

```json
{
  "dxt_version": "0.1",
  "name": "context7",
  "display_name": "Context7",
  "version": "1.0.1",
  "description": "Up-to-date Code Docs For Any Prompt",
  "author": { "name": "Upstash", "email": "context7@upstash.com", "url": "https://upstash.com" },
  "server": {
    "type": "node",
    "entry_point": "dist/index.js",
    "mcp_config": {
      "command": "node",
      "args": ["${__dirname}/dist/index.js"],
      "env": {}
    }
  },
  "tools": [
    { "name": "Resolve Context7 Library ID", "description": "Resolves a package name to a Context7 library ID." },
    { "name": "Get Library Docs", "description": "Fetches up-to-date documentation for a library." }
  ],
  "compatibility": { "platforms": ["darwin", "win32", "linux"], "runtimes": { "node": ">=v18.0.0" } }
}
```

### With user_config: Filesystem (manifest_version 0.2, Anthropic)

```json
{
  "manifest_version": "0.2",
  "name": "Filesystem",
  "display_name": "Filesystem",
  "version": "0.2.0",
  "description": "Let Claude access your filesystem to read and write files.",
  "author": { "name": "Anthropic", "url": "https://www.claude.ai" },
  "server": {
    "type": "node",
    "entry_point": "server/index.js",
    "mcp_config": {
      "command": "node",
      "args": ["${__dirname}/server/index.js", "${user_config.allowed_directories}"]
    }
  },
  "user_config": {
    "allowed_directories": {
      "type": "directory",
      "title": "Allowed Directories",
      "description": "Select directories the filesystem server can access",
      "multiple": true,
      "required": true,
      "default": []
    }
  },
  "compatibility": { "platforms": ["darwin", "win32", "linux"], "runtimes": { "node": ">=16.0.0" } }
}
```

### Full-featured: himalaya-mcp (manifest_version 0.3, 19 tools, 4 prompts)

```json
{
  "manifest_version": "0.3",
  "name": "himalaya-mcp",
  "display_name": "Himalaya Email",
  "version": "1.3.0",
  "description": "Privacy-first email for Claude via the himalaya CLI.",
  "author": { "name": "Data-Wise", "url": "https://github.com/Data-Wise" },
  "server": {
    "type": "node",
    "entry_point": "dist/index.js",
    "mcp_config": {
      "command": "node",
      "args": ["${__dirname}/dist/index.js"],
      "env": {
        "HIMALAYA_BINARY": "${user_config.himalaya_binary}",
        "HIMALAYA_ACCOUNT": "${user_config.himalaya_account}",
        "HIMALAYA_FOLDER": "${user_config.himalaya_folder}"
      }
    }
  },
  "user_config": {
    "himalaya_binary": { "type": "file", "title": "Himalaya Binary", "required": false },
    "himalaya_account": { "type": "string", "title": "Default Account", "required": false },
    "himalaya_folder": { "type": "string", "title": "Default Folder", "default": "INBOX", "required": false }
  },
  "tools": [ /* 19 tools */ ],
  "prompts": [ /* 4 prompts with arguments and text */ ],
  "compatibility": { "platforms": ["darwin"], "runtimes": { "node": ">=22.0.0" } }
}
```

---

## 19. References

- [MCPB GitHub Repository (anthropics/mcpb)](https://github.com/anthropics/mcpb) -- Spec, CLI, reference implementation
- [MANIFEST.md - Full Specification](https://github.com/anthropics/mcpb/blob/main/MANIFEST.md)
- [CLI.md - CLI Documentation](https://github.com/anthropics/mcpb/blob/main/CLI.md)
- [Anthropic Engineering: Desktop Extensions](https://www.anthropic.com/engineering/desktop-extensions) -- Launch blog post
- [Building Desktop Extensions with MCPB (Claude Help Center)](https://support.claude.com/en/articles/12922929-building-desktop-extensions-with-mcpb) -- Developer guide
- [Adopting the MCP Bundle format (MCP Blog)](http://blog.modelcontextprotocol.io/posts/2025-11-20-adopting-mcpb/) -- DXT to MCPB rename announcement
- [@anthropic-ai/mcpb on npm](https://www.npmjs.com/package/@anthropic-ai/mcpb)
- [desktopextensions.com](https://www.desktopextensions.com/) -- Community directory
