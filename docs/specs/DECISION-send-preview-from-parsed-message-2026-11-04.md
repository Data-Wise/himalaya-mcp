# Decision: v2 send preview shows the parsed message, not the template text

**Status:** Accepted
**Date:** 2026-11-04
**Implemented in:** #161 (`7bee33a`)
**Origin:** automated security review of #157 flagged a preview/send parser differential and header injection in `src/himalaya/message.ts` and `src/tools/compose.ts`.

## Context

On himalaya v2 there are no templates or MML, so `send_email` takes the reviewed template text (from `draft_reply`), re-parses it with `postal-mime`, rebuilds a message with nodemailer's MailComposer, and sends it. Until #161 the confirmation preview echoed the template text as typed, while the send used the parsed fields. Two things could make those differ: encoded-word (RFC 2047) values that decode to something other than what the raw text suggests, and display names that break quoting.

Probes run before changing anything (postal-mime 4.2.0):

- CRLF smuggled into an encoded-word Subject was collapsed to a space by the parser, so no `Bcc:` line appeared. Not exploitable today, but the code relied on the parser for that.
- An encoded-word display name containing commas and angle brackets stayed one recipient after rebuild.
- A display name ending in a backslash broke the quoting: `To: <"x\" real"@x.test>`, a garbled recipient.

## Decision

On v2, `send_email` parses the template once. The preview is rendered from the normalized fields (`renderOutgoing`: decoded From/To/Cc/Bcc, subject, threading headers, attachment list) and the send builds and sends that same object. A template with no recipient is rejected at preview time. Decoded header values are cleaned (`cleanHeaderValue`: control characters and Unicode line separators become spaces) and display names also lose `"` and `\`.

## Alternatives considered

### Keep echoing the template text
- Pro: no change.
- Rejected: the user approves text that is not what is sent.

### Reject templates containing encoded words or MIME structure
- Pro: removes the differential by refusing the input.
- Rejected: encoded words are how non-ASCII subjects and names are written, so this would break normal mail.

### Keep structured fields server-side and have `send_email` use them
- Pro: no re-parsing of free text at send time.
- Rejected for now: `send_email`'s contract is that the caller passes the template text, which the agent may edit before sending. Changing that is a larger API change than the finding justified.

## Consequences

- What the user approves is what is sent, including a decoded Bcc.
- Preview text differs from the typed template: names are normalized and quotes and backslashes are dropped from display names.
- v1 is unchanged: it still sends the template through `message send` and echoes it.
- Tests assert that the recipients in the preview equal the recipients in the message passed to `sendRaw`, and that a no-recipient template fails at preview time. Six of the seven new tests fail on the pre-#161 code.
- Residual risk: himalaya derives the SMTP envelope from the built message's headers. That step was not changed here.
