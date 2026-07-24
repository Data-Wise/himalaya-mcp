# Migrate to Plugin Name `himalaya`

**Applies to:** v2.0.0+

In v2.0.0, the plugin was renamed from `email` to `himalaya` to match the CLI binary name.

## What Changed

| Before (v1.x) | After (v2.0) |
|----------------|--------------|
| Plugin name: `email` | Plugin name: `himalaya` |
| Skills: `/email:inbox` | Skills: `/himalaya:inbox` |
| Hook matcher: `mcp__plugin_email_himalaya` | Hook matcher: `mcp__plugin_himalaya_email` |
| Install: `claude plugin install email` | Install: `claude plugin install himalaya` |

**Tool names** changed from `mcp__plugin_email_himalaya__*` to `mcp__plugin_himalaya_email__*`. This affects hook configs and any `allowedTools` references.

## How to Migrate

### 1. Reinstall the plugin

```bash
claude plugin uninstall email
claude plugin install himalaya
```

### 2. Update custom skills

If you have custom skills that reference `/email:` commands, update them:

```bash
# Find stale references
grep -rn '/email:' ~/.claude/skills/

# Replace with /himalaya:
sed -i '' 's|/email:|/himalaya:|g' ~/.claude/skills/*.md
```

### 3. Update CLAUDE.md (if customized)

If your project's `CLAUDE.md` references plugin commands:

```bash
# Find stale references
grep -rn '/email:' CLAUDE.md

# Replace with /himalaya:
sed -i '' 's|/email:|/himalaya:|g' CLAUDE.md
```

### 4. Update hook configs (if customized)

If you have custom hook configs referencing the old matcher:

```json
{
  "matcher": "mcp__plugin_himalaya_email__*"
}
```

## Breaking Changes

- **Tool name mismatch**: If you have cached tool references (e.g., in hook configs or `allowedTools`), update them to `mcp__plugin_himalaya_email__*`.
- **Skill commands**: All `/email:*` skill commands are now `/himalaya:*`.
- **Install command**: `claude plugin install email` no longer works. Use `claude plugin install himalaya`.

## Verify

After migrating, run:

```
/himalaya:help
```

If the command is recognized, migration is complete.
