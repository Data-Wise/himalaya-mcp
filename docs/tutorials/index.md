# Tutorials

Step-by-step guides from simple to advanced. Each tutorial builds on the previous one -- start at Level 1 and work your way up.

## Learning Path

```mermaid
flowchart LR
    subgraph L1["Level 1: Getting Started"]
        A1[Read First Email] --> A2[Multi-Account]
        A2 --> A3[Desktop Extension]
    end

    subgraph L2["Level 2: Productivity"]
        B1[Triage Inbox] --> B2[Reply to Email]
        B2 --> B4[Compose Email]
        B4 --> B5[Attachments & Calendar]
        B5 --> B6[Search & Manage]
        B6 --> B3[Export & Save]
    end

    subgraph L3["Level 3: Automation"]
        C1[Automate with Agent]
    end

    L1 --> L2 --> L3

    style L1 fill:#f5e6d3,stroke:#c4a882
    style L2 fill:#e8d5c4,stroke:#b8956a
    style L3 fill:#d4c4b0,stroke:#a07850
```

## Tutorials by Level

### Level 1: Getting Started

Get comfortable reading and navigating your email through Claude.

| Tutorial | Time | What You'll Learn |
|----------|------|-------------------|
| [Read Your First Email](read-first-email.md) | 2 min | List inbox, read messages, HTML vs plain text |
| [Multi-Account Email](multi-account.md) | 3 min | Switch accounts, cross-account queries, defaults |
| [Desktop Extension](desktop-extension.md) | 5 min | Install .mcpb, configure, use in Claude Desktop/Cowork |

### Level 2: Productivity

Organize, reply, and export emails efficiently.

| Tutorial | Time | Prerequisites |
|----------|------|---------------|
| [Triage Your Inbox](triage-inbox.md) | 5 min | Level 1 |
| [Reply to an Email](reply-email.md) | 5 min | Level 1 |
| [Compose and Send Email](compose-email.md) | 5 min | Level 1 |
| [Attachments and Calendar](attachments-calendar.md) | 5 min | Level 1 |
| [Search and Manage](../guide/workflows.md#17-search-and-filter-emails) | 5 min | Level 1 |
| [Export and Save Emails](export-save.md) | 3 min | Level 1 |

### Level 3: Automation

Let the email-assistant agent handle your entire inbox workflow.

| Tutorial | Time | Prerequisites |
|----------|------|---------------|
| [Automate with the Agent](automate-agent.md) | 10 min | Level 2 |

---

**Total learning time:** ~43 minutes from zero to full automation.

**Prerequisites:** [Installation](../getting-started/installation.md) complete and himalaya CLI configured with at least one email account.
