# Decision: how himalaya v2 message bodies are read

**Status:** Accepted
**Date:** 2026-11-04
**Implemented in:** #151 (`bedc0e5`), #157 (`ee93812`), #158 (`cf5e328`)
**Builds on:** `SPEC-himalaya-v2-cli-compat-2026-08-03.md`

## Context

himalaya v2 changed what the message commands print, and `message export` was removed. Observed against v2.2.1:

- `message read <id> --json` prints a parsed MIME tree: `{html_body:[i], text_body:[i], attachments:[i], parts:[{headers, body:{Text|Html|Multipart|Binary}}]}`. For a non-multipart message both index arrays are `[0]`, so only the matching variant must be taken.
- `message read <id> --raw --json` prints `{"message": "<raw RFC 5322>"}`.
- `message reply <id>` prints the raw reply on plain stdout; with `--json` it prints decoded fields (`{from,to,cc,bcc,subject,body}`) without `In-Reply-To` or `References`.

`HimalayaClient.exec` appended `--json` to every v2 command. That produced #144 (`read_email` returned `text` as an object), #145 (`render_email` ENOENT on the removed export), and later #158 (`draft_reply` returned an empty draft).

## Decision

- **`readMessageHtml`** reads `message read --json` and extracts the HTML part with `extractV2Bodies`; it returns `""` when there is none so `render_email` falls back to plain text.
- **`readRawMessage`** (named as in #148) reads `--raw` and accepts the `{"message": ...}` envelope or a bare JSON string, falling back to stdout.
- **`readMessage`** (`read_email`) decodes the raw message with `postal-mime` and returns the text part JSON-encoded like v1, so `parseMessageBody` reads both generations. `parseMessageBody` also still handles a v2 object and always returns a string.
- **`exec`** takes `json: false` for commands whose plain stdout is the payload; `replyRaw` uses it.

## Alternatives considered

### Decode everything from the raw message (#148's `readMessageHtml`)
- Equivalent in behavior; one parser for all reads.
- Not taken: #151's version was already checked live on plain, multipart, HTML-only and attachment messages, and keeping both would mean two implementations of one read.

### Keep `--json` on every command and rebuild the reply from the decoded fields
- Rejected: the decoded fields drop the threading headers a reply needs.

## Consequences

- Two body-reading mechanisms coexist (parsed JSON for HTML, raw decode for text and raw), each with tests.
- Mock tests built from hand-written fixtures hid #158. Fixtures for himalaya's output should be captured from the real binary, and a live check belongs in any PR that changes how output is read.
- A command whose plain stdout is the payload must opt out of `--json` explicitly.
