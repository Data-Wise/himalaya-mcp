# Bundling himalaya CLI for macOS Distribution

**Date:** 2026-02-16
**Purpose:** Research findings for bundling himalaya CLI binary within .mcpb distribution

---

## 1. Pre-built himalaya Binaries for macOS

### Available Downloads

**Source:** [himalaya v1.1.0 release](https://github.com/pimalaya/himalaya/releases/tag/v1.1.0)

| Platform | Filename | Compressed Size | Extracted Size | Download URL |
|----------|----------|----------------|----------------|--------------|
| macOS arm64 | `himalaya.aarch64-darwin.tgz` | 9.0 MB | 24 MB | [Download](https://github.com/pimalaya/himalaya/releases/download/v1.1.0/himalaya.aarch64-darwin.tgz) |
| macOS x64 | `himalaya.x86_64-darwin.tgz` | 9.3 MB | 25 MB | [Download](https://github.com/pimalaya/himalaya/releases/download/v1.1.0/himalaya.x86_64-darwin.tgz) |

### Binary Details

- **arm64 binary:** 24 MB (Mach-O 64-bit executable arm64)
- **x64 binary:** 25 MB (Mach-O 64-bit executable x86_64)
- **Archive includes:** Binary + completions + man pages + desktop file
- **Current installed version:** v1.1.0 (Homebrew installs 24 MB arm64 binary)

### Tarball Contents

```
himalaya                         # The binary
share/
  man/                          # Man pages
  completions/                  # Shell completions (bash, zsh, fish, elvish)
  applications/himalaya.desktop # Desktop entry file
```

---

## 2. Creating Universal (Fat) Binaries

### Using `lipo` Command

Apple's `lipo` tool merges architecture-specific binaries into a single universal binary:

```bash
# Download both architectures
curl -L https://github.com/pimalaya/himalaya/releases/download/v1.1.0/himalaya.aarch64-darwin.tgz | tar xzf - himalaya
mv himalaya himalaya-arm64

curl -L https://github.com/pimalaya/himalaya/releases/download/v1.1.0/himalaya.x86_64-darwin.tgz | tar xzf - himalaya
mv himalaya himalaya-x64

# Create universal binary
lipo -create himalaya-arm64 himalaya-x64 -output himalaya-universal

# Verify
lipo -info himalaya-universal
# Output: Architectures in the fat file: himalaya-universal are: x86_64 arm64
```

### Size Comparison

| Binary Type | Uncompressed | Compressed (gzip) |
|-------------|--------------|-------------------|
| arm64 only | 24 MB | 9.0 MB |
| x64 only | 25 MB | 9.3 MB |
| Universal (fat) | 49 MB | 18.3 MB |

**Key Insight:** Universal binary is ~49 MB (nearly double), but compressed is only 18.3 MB (not quite double due to compression overhead).

### Recommendation: Platform-Specific vs Universal

**Option A: Ship platform-specific binaries**
- Pros: Smaller download (9 MB vs 18 MB), faster extraction
- Cons: Runtime architecture detection required, separate files to manage

**Option B: Ship universal binary**
- Pros: Single binary, simpler distribution, works on all Macs
- Cons: ~2x size (18 MB compressed, 49 MB uncompressed)

**Recommended:** **Ship universal binary** for simplicity. 18 MB is acceptable for one-click installation, and it eliminates runtime detection complexity.

---

## 3. macOS Code Signing & Gatekeeper

### Gatekeeper Requirements

macOS Gatekeeper enforces cryptographic signing requirements for downloaded binaries. [Source: [Apple Codesign Documentation](https://gregoryszorc.com/docs/apple-codesign/stable/apple_codesign_gatekeeper.html)]

### Can Unsigned Binaries Run?

**Short answer:** Yes, but with user friction.

#### Unsigned Binary Behavior

1. **First Launch:** macOS kills the binary before it launches when run from Terminal
2. **User Override Required:**
   - Go to System Settings → Privacy & Security
   - Find "Security" section
   - Click "Open Anyway" where message appears
   - Enter admin credentials
3. **Subsequent Runs:** Binary allowed after override

[Source: [So You Want to Code-Sign macOS Binaries?](https://dennisbabkin.com/blog/?t=how-to-get-certificate-code-sign-notarize-macos-binaries-outside-apple-app-store)]

#### Ad-Hoc Signing

- **What it is:** "Ad-hoc codesigning" is essentially just a checksum of the executable
- **Where it works:** Only on the local machine that built it
- **When copied:** macOS will kill it before launch on other machines
- **Not sufficient for distribution**

[Source: [macOS distribution gist](https://gist.github.com/rsms/929c9c2fec231f0cf843a1a746a416f5)]

### Proper Distribution Path

For frictionless distribution, binaries should be:

1. **Signed** with a Developer ID certificate (requires Apple Developer account)
2. **Hardened** (`codesign -o runtime`)
3. **Notarized** via Apple's notarization service

Gatekeeper allows execution only when all three conditions are met. [Source: [DigiCert Code Signing Guide 2026](https://comparecheapssl.com/digicert-code-signing-for-mac-developers-a-complete-guide/)]

### Implications for himalaya-mcp

**Current State:** himalaya binaries from GitHub releases are **unsigned** (community project, no Apple Developer certificate)

**Distribution Options:**

1. **Bundle unsigned binary + document manual approval**
   - User must approve binary on first run (System Settings)
   - Document in setup guide with screenshots
   - Acceptable for power users / developers

2. **Don't bundle, require Homebrew install**
   - `brew install himalaya` handles binary installation
   - Our .mcpb just wraps the CLI
   - Cleaner separation of concerns
   - **Current approach** (documented in setup guide)

3. **Sign binaries ourselves (future)**
   - Requires Apple Developer account ($99/year)
   - Sign universal binary after creation
   - Notarize via Apple
   - Provides frictionless install experience

**Recommendation:** **Keep current approach** (Homebrew install) for now. Add bundled unsigned binary as optional future enhancement with clear documentation.

---

## 4. Size Analysis

### Component Breakdown

| Component | Size | Notes |
|-----------|------|-------|
| himalaya binary (universal) | 49 MB uncompressed, 18.3 MB gzip | Rust binary with all features |
| Node.js runtime (if bundled) | ~67 KB (symlink) | Not needed—.mcpb uses system Node.js |
| Our dist/index.js | 2.3 KB | esbuild bundle (minimal, imports only) |
| MCP server code (with deps) | ~595 KB | Estimated from package.json dependencies |

### .mcpb Bundle Size Estimate

**If bundling himalaya binary:**

```
manifest.json:           ~2 KB
dist/index.js:           ~3 KB
node_modules/: ~        500 KB (MCP SDK + deps)
bin/himalaya-universal: ~49 MB (uncompressed)
-----------------------------------
Total uncompressed:     ~50 MB
Total compressed (zip): ~19 MB (estimated)
```

**Without bundling binary (current approach):**

```
manifest.json:          ~2 KB
dist/index.js:          ~3 KB
node_modules/:       ~500 KB
-----------------------------------
Total uncompressed:    ~505 KB
Total compressed (zip): ~150 KB (estimated)
```

**Recommendation:** Start with **no-bundle approach** (~150 KB), add optional bundled variant later for advanced users.

---

## 5. Runtime Architecture Detection in Node.js

### Using `process.arch` and `process.platform`

Node.js provides built-in architecture detection:

```javascript
console.log('Platform:', process.platform);    // "darwin" on macOS
console.log('Architecture:', process.arch);    // "arm64" or "x64"

// Example usage in binary selection
const binaryPath = process.arch === 'arm64'
  ? path.join(__dirname, 'bin', 'himalaya-arm64')
  : path.join(__dirname, 'bin', 'himalaya-x64');
```

### Platform Detection Values

| Platform | `process.platform` | `process.arch` (Intel) | `process.arch` (Apple Silicon) |
|----------|-------------------|----------------------|-------------------------------|
| macOS | `"darwin"` | `"x64"` | `"arm64"` |
| Linux | `"linux"` | `"x64"` | `"arm64"` |
| Windows | `"win32"` | `"x64"` | N/A |

### Implementation Pattern for Platform-Specific Binaries

```javascript
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getHimalayaBinary() {
  // Check system install first
  if (process.env.HIMALAYA_BINARY) {
    return process.env.HIMALAYA_BINARY;
  }

  // Check system PATH
  const systemBinary = 'himalaya'; // Resolved via PATH

  // Fallback to bundled binary (if present)
  const platform = process.platform;
  const arch = process.arch;

  if (platform !== 'darwin') {
    throw new Error('Bundled binaries only available for macOS');
  }

  // With universal binary:
  return path.join(__dirname, '..', 'bin', 'himalaya-universal');

  // With platform-specific binaries:
  // const binaryName = arch === 'arm64' ? 'himalaya-arm64' : 'himalaya-x64';
  // return path.join(__dirname, '..', 'bin', binaryName);
}
```

### Rosetta 2 Considerations

- x64 binaries run on Apple Silicon Macs via Rosetta 2
- arm64 binaries **cannot** run on Intel Macs
- Universal binaries automatically select correct architecture
- No runtime detection needed with universal binary

---

## 6. MCPB Bundle Format Specification

### Overview

`.mcpb` files are simple ZIP archives containing an MCP server and metadata. Spiritually similar to Chrome extensions (.crx) or VS Code extensions (.vsix).

[Source: [Adopting the MCP Bundle format](http://blog.modelcontextprotocol.io/posts/2025-11-20-adopting-mcpb/), [MCPB GitHub](https://github.com/modelcontextprotocol/mcpb)]

### Required Structure

```
my-server.mcpb (ZIP archive)
├── manifest.json          # Required: metadata + server config
├── server/                # Server code (Node.js, Python, or binary)
│   └── index.js
├── node_modules/          # Bundled dependencies (optional)
└── icon.png               # Optional: icon for UI
```

### manifest.json Schema

**Required fields:**

```json
{
  "manifest_version": "0.3",
  "name": "himalaya-mcp",
  "version": "1.2.0",
  "description": "Privacy-first email MCP server",
  "author": {
    "name": "Data-Wise"
  },
  "server": {
    "type": "node",
    "entry_point": "dist/index.js",
    "mcp_config": {
      "command": "node",
      "args": ["${__dirname}/dist/index.js"],
      "env": {
        "HIMALAYA_BINARY": "himalaya"  // Or bundled path
      }
    }
  }
}
```

**Optional fields:**

- `display_name`: Human-readable name
- `icon` / `icons`: PNG assets
- `repository`, `homepage`, `documentation`: URLs
- `tools`, `prompts`: Declared capabilities
- `compatibility`: Platform/runtime requirements
- `user_config`: Configurable parameters

### Bundling Binaries in MCPB

The manifest spec supports bundling binaries via:

1. **Platform-specific paths:**

```json
{
  "server": {
    "type": "node",
    "mcp_config": {
      "env": {
        "HIMALAYA_BINARY": "${__dirname}/bin/himalaya-universal"
      }
    }
  }
}
```

2. **Compatibility constraints:**

```json
{
  "compatibility": {
    "platforms": ["darwin"],  // macOS only
    "runtimes": {
      "node": ">=18.0.0"
    }
  }
}
```

3. **Variable substitution:**

- `${__dirname}`: Bundle root directory
- `${user_config.KEY}`: User configuration values
- `${HOME}`: User home directory

### Bundle Size Implications

| Approach | Bundle Size | Distribution | User Setup |
|----------|-------------|--------------|-----------|
| No binary | ~150 KB | One-click install | Manual `brew install himalaya` |
| Bundled universal | ~19 MB | Fully self-contained | None (code signing friction) |
| Bundled platform-specific | ~9-10 MB | Self-contained | None (code signing friction) |

---

## 7. Recommendations

### Phase 1: Current Approach (Ship Now)

**Don't bundle himalaya binary.**

- Keep `.mcpb` at ~150 KB
- Document Homebrew install: `brew install himalaya`
- Use `HIMALAYA_BINARY` env var for flexible binary location
- **Why:** Avoids code signing complexity, smaller download, separates concerns

### Phase 2: Optional Bundled Variant (Future)

**Offer bundled `.mcpb` as alternate download.**

- Create `himalaya-mcp-bundled.mcpb` (~19 MB)
- Include universal binary (arm64 + x64)
- Document manual approval requirement (System Settings)
- Target: Power users who want zero-dependency install
- **Why:** Some users prefer self-contained bundles despite code signing friction

### Phase 3: Signed & Notarized (Long-term)

**Get Apple Developer certificate, sign binaries.**

- Sign universal binary with Developer ID
- Notarize via Apple
- Frictionless install for all users
- **Why:** Best UX, but requires $99/year + notarization workflow

---

## 8. Implementation Checklist

### For Current Release (No Bundle)

- [x] Document `brew install himalaya` in setup guide
- [x] Use `HIMALAYA_BINARY` env var in config
- [x] Test with system-installed himalaya
- [ ] Add compatibility check to verify himalaya available
- [ ] Error message: "himalaya not found, install via: brew install himalaya"

### For Future Bundled Variant

- [ ] Download arm64 + x64 binaries from GitHub releases
- [ ] Create universal binary with `lipo -create`
- [ ] Add `bin/himalaya-universal` to bundle
- [ ] Update manifest.json with bundled binary path
- [ ] Write documentation for manual approval (screenshots)
- [ ] Test on fresh macOS install (both Intel and Apple Silicon)

### For Signed Variant (Future)

- [ ] Obtain Apple Developer account
- [ ] Generate Developer ID certificate
- [ ] Sign universal binary: `codesign -s "Developer ID" --options runtime bin/himalaya-universal`
- [ ] Notarize via `xcrun notarytool`
- [ ] Verify Gatekeeper acceptance
- [ ] Update distribution workflow

---

## References

- [himalaya releases](https://github.com/pimalaya/himalaya/releases)
- [Building a universal macOS binary](https://developer.apple.com/documentation/apple-silicon/building-a-universal-macos-binary)
- [A deep dive on macOS universal binaries](https://www.jviotti.com/2021/07/23/a-deep-dive-on-macos-universal-binaries.html)
- [So You Want to Code-Sign macOS Binaries?](https://dennisbabkin.com/blog/?t=how-to-get-certificate-code-sign-notarize-macos-binaries-outside-apple-app-store)
- [macOS distribution gist](https://gist.github.com/rsms/929c9c2fec231f0cf843a1a746a416f5)
- [Apple Codesign Gatekeeper Primer](https://gregoryszorc.com/docs/apple-codesign/stable/apple_codesign_gatekeeper.html)
- [MCPB Bundle Format](http://blog.modelcontextprotocol.io/posts/2025-11-20-adopting-mcpb/)
- [MCPB GitHub](https://github.com/modelcontextprotocol/mcpb)
- [Node.js Single Executable Applications](https://nodejs.org/api/single-executable-applications.html)

---

**Last Updated:** 2026-02-16
