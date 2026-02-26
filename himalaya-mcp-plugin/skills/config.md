---
name: email:config
description: Setup wizard for himalaya email — check installation, configure accounts, test connectivity
triggers:
  - email config
  - email setup
  - configure email
  - himalaya setup
  - setup email
---

# /email:config - Email Setup Wizard

Check himalaya installation, configure email accounts, and verify connectivity.

## Usage

```
/email:config                # Full setup wizard (interactive)
/email:config --check        # Validate current setup without changes
/email:config --add-account  # Add an additional email account
```

## When Invoked (No Args) — Setup Wizard

### Step 1: Check Prerequisites

```bash
which himalaya    # Is himalaya CLI installed?
```

If not installed:
```
❌ himalaya CLI not found

Install via Homebrew:
  brew install himalaya

Or see: https://github.com/pimalaya/himalaya
```

### Step 2: Check Configuration

Look for `~/.config/himalaya/config.toml`:

If config exists → jump to Step 5 (validate)

If no config → continue to Step 3 (interactive setup)

### Step 3: Choose Provider

Ask the user which email provider to configure:

```
📧 Email Setup

Which provider?
  1. Gmail
  2. Outlook / Microsoft 365
  3. Fastmail
  4. Custom IMAP/SMTP
```

### Step 4: Generate Configuration

Based on provider choice, generate `~/.config/himalaya/config.toml`:

**Gmail template:**
```toml
[accounts.gmail]
default = true
email = "<user>@gmail.com"
display-name = "<name>"

backend.type = "imap"
backend.host = "imap.gmail.com"
backend.port = 993
backend.encryption = "tls"
backend.auth.type = "password"
backend.auth.command = "security find-generic-password -s himalaya-gmail -w"

message.send.backend.type = "smtp"
message.send.backend.host = "smtp.gmail.com"
message.send.backend.port = 465
message.send.backend.encryption = "tls"
message.send.backend.auth.type = "password"
message.send.backend.auth.command = "security find-generic-password -s himalaya-gmail -w"
```

**For Gmail users, explain app password requirement:**
```
⚠️  Gmail requires an App Password (not your regular password)

1. Go to https://myaccount.google.com/apppasswords
2. Generate an app password for "Mail"
3. Store it in macOS Keychain:
   security add-generic-password -s himalaya-gmail -a <email> -w <app-password>
```

**Outlook template:**
```toml
[accounts.outlook]
default = true
email = "<user>@outlook.com"
display-name = "<name>"

backend.type = "imap"
backend.host = "outlook.office365.com"
backend.port = 993
backend.encryption = "tls"
backend.auth.type = "password"
backend.auth.command = "security find-generic-password -s himalaya-outlook -w"

message.send.backend.type = "smtp"
message.send.backend.host = "smtp.office365.com"
message.send.backend.port = 587
message.send.backend.encryption = "start-tls"
message.send.backend.auth.type = "password"
message.send.backend.auth.command = "security find-generic-password -s himalaya-outlook -w"
```

**Fastmail template:**
```toml
[accounts.fastmail]
default = true
email = "<user>@fastmail.com"
display-name = "<name>"

backend.type = "imap"
backend.host = "imap.fastmail.com"
backend.port = 993
backend.encryption = "tls"
backend.auth.type = "password"
backend.auth.command = "security find-generic-password -s himalaya-fastmail -w"

message.send.backend.type = "smtp"
message.send.backend.host = "smtp.fastmail.com"
message.send.backend.port = 465
message.send.backend.encryption = "tls"
message.send.backend.auth.type = "password"
message.send.backend.auth.command = "security find-generic-password -s himalaya-fastmail -w"
```

### Step 5: Test Connection

```bash
himalaya account list    # Verify account is accessible
```

If successful:
```
✅ Connection successful

Account: gmail
  Email: user@gmail.com
  IMAP: imap.gmail.com:993 (TLS)
  SMTP: smtp.gmail.com:465 (TLS)
```

If failed, show the error and common fixes:
```
❌ Connection failed: authentication error

Common fixes:
  • Gmail: Ensure you're using an App Password, not your regular password
  • Check Keychain entry: security find-generic-password -s himalaya-gmail -w
  • Verify config file: cat ~/.config/himalaya/config.toml
```

### Step 6: Verify MCP Integration

```bash
himalaya-mcp doctor    # End-to-end check
```

```
✅ Setup complete!

himalaya CLI .... installed (v1.0.0)
Config file ..... ~/.config/himalaya/config.toml
Account ......... gmail (user@gmail.com)
IMAP ............ connected
SMTP ............ connected
MCP server ...... running

→ Try "/email:inbox" to check your email
→ Try "/email:stats" for inbox overview
```

## When Invoked with --check

Skip the interactive wizard. Just validate:

1. Check himalaya binary exists
2. Check config.toml exists and is valid
3. Test connection with `himalaya account list`
4. Run `himalaya-mcp doctor` if available
5. Report status

```
📧 Email Config Check

himalaya CLI .... ✅ installed (v1.0.0)
Config file ..... ✅ ~/.config/himalaya/config.toml
Account(s) ...... ✅ gmail (user@gmail.com)
Connection ...... ✅ IMAP connected
MCP server ...... ✅ plugin enabled

Everything looks good!
```

## When Invoked with --add-account

1. Ask for provider (same as Step 3)
2. Generate account section (appended to existing config.toml)
3. Test connection for new account only
4. Confirm multi-account setup

```
✅ Account added: work

Accounts configured:
  • gmail (default) — user@gmail.com
  • work — user@company.com

→ Use "account: work" parameter with any tool to access work email
→ "/email:inbox" defaults to gmail (default account)
```
