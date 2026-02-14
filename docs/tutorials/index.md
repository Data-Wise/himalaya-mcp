# Tutorials

Step-by-step guides from simple to advanced. Each tutorial builds on the previous one -- start at Level 1 and work your way up.

## Learning Path

```mermaid
flowchart LR
    subgraph L1["Level 1: Getting Started"]
        A1["Read Your\nFirst Email"] --> A2["Multi-Account\nEmail"]
    end

    subgraph L2["Level 2: Productivity"]
        B1["Triage Your\nInbox"] --> B2["Reply to\nan Email"]
        B2 --> B3["Export &\nSave Emails"]
    end

    subgraph L3["Level 3: Automation"]
        C1["Automate with\nthe Agent"]
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

### Level 2: Productivity

Organize, reply, and export emails efficiently.

| Tutorial | Time | Prerequisites |
|----------|------|---------------|
| [Triage Your Inbox](triage-inbox.md) | 5 min | Level 1 |
| [Reply to an Email](reply-email.md) | 5 min | Level 1 |
| [Export and Save Emails](export-save.md) | 3 min | Level 1 |

### Level 3: Automation

Let the email-assistant agent handle your entire inbox workflow.

| Tutorial | Time | Prerequisites |
|----------|------|---------------|
| [Automate with the Agent](automate-agent.md) | 10 min | Level 2 |

---

**Total learning time:** ~28 minutes from zero to full automation.

**Prerequisites:** [Installation](../getting-started/installation.md) complete and himalaya CLI configured with at least one email account.
