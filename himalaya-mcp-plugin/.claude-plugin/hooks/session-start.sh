#!/bin/bash
# SessionStart hook: inject email context into every conversation
# This tells Claude that email tools are available without needing /email:* commands

cat <<'EOF'
{"additionalContext": "Email plugin (himalaya-mcp) is active. When the user mentions email, inbox, messages, triage, or mail — use the himalaya MCP tools directly. Available skills: /email:inbox (check email), /email:triage (classify inbox), /email:digest (daily summary), /email:compose (new email), /email:reply (reply to email), /email:search (find emails), /email:manage (flag/move/archive), /email:attachments (list/download), /email:stats (inbox analytics), /email:config (setup), /email:help (commands reference)."}
EOF
