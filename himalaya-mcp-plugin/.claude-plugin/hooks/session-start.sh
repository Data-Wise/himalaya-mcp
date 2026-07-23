#!/bin/bash
# SessionStart hook: inject email context into every conversation
# This tells Claude that email tools are available without needing /himalaya:* commands

cat <<'EOF'
{"additionalContext": "Email plugin (himalaya-mcp) is active. When the user mentions email, inbox, messages, triage, or mail — use the himalaya MCP tools directly. Available skills: /himalaya:inbox (check email), /himalaya:triage (classify inbox), /himalaya:digest (daily summary), /himalaya:compose (new email), /himalaya:reply (reply to email), /himalaya:search (find emails), /himalaya:manage (flag/move/archive), /himalaya:attachments (list/download), /himalaya:stats (inbox analytics), /himalaya:config (setup), /himalaya:help (commands reference)."}
EOF
