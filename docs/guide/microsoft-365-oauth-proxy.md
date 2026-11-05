# Microsoft 365 via email-oauth2-proxy

Microsoft 365 (Exchange Online) disables password login for IMAP/SMTP, so himalaya cannot talk to it directly. A common setup is [`email-oauth2-proxy`](https://github.com/simonrob/email-oauth2-proxy): himalaya speaks plain IMAP/SMTP to `127.0.0.1`, and the proxy performs OAuth 2.0 against Office 365.

himalaya-mcp is unaware of the proxy. It only runs the `himalaya` CLI, so **if `himalaya envelope list --json` works, the MCP tools work**.

## himalaya config

```toml
[accounts.work]
email = "you@example.edu"
imap.server = "imap://127.0.0.1:1993"
imap.sasl.plain.username = "you@example.edu"
imap.sasl.plain.password.command = "echo you@example.edu"
smtp.server = "smtp://127.0.0.1:1587"
smtp.sasl.plain.username = "you@example.edu"
smtp.sasl.plain.password.command = "echo you@example.edu"
```

The "password" is not a secret, but it must stay **constant**. See below.

## First sign-in (device-code flow)

With `oauth2_flow = device` the proxy prints a one-time code the first time a client connects:

```text
Visit https://login.microsoft.com/device and use code XXXXXXXXX
```

Open that page, enter the code, sign in, and approve. Two details decide whether it sticks:

1. **himalaya gives up after 60 seconds.** Signing in takes longer, and a dropped connection invalidates its code. Hold the first connection open with any IMAP client that has a long timeout (for example Python's `imaplib` with a 600-second socket timeout), or run the proxy in the foreground with `--debug --log-file proxy.log` so you can read the code and the result.
2. **Each connection mints its own code.** Do not start several attempts; approve the newest code only. Codes expire after about 15 minutes.

## The password must match every time

The proxy encrypts the stored token with a key derived from the IMAP password the client sends. If the first sign-in uses one password (say a test script's `placeholder`) and himalaya later sends another, the proxy cannot decrypt the token, discards it, and asks you to sign in again. With the default `delete_account_token_on_password_error`, this repeats forever.

Use the same string in your hold-open script and in himalaya's `password.command`.

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| `stream stopped responding after 60s` | No stored token; the proxy is waiting for you to approve a code. Check the proxy log. |
| Approved the page, proxy still says "waiting" | Approved a code from a superseded attempt, or the page step was not finished. Use the newest code only. |
| Signed in, then asked to sign in again | Password mismatch (above). |
| `AADSTS7000218 ... client_assertion or client_secret` | The app registration behind your `client_id` is not a public client in your tenant. Ask your IT group for a registration with "Allow public client flows" enabled. A different public client ID will hit the same tenant policy. |
| `nc -z 127.0.0.1 1993` succeeds but nothing works | A listening port does not prove a valid token. Run `himalaya envelope list --json`. |

The default (non-debug) proxy log can show no sign-in lines when run under `launchd`. For diagnosis, stop the service and run the proxy in the foreground with `--debug --log-file`, then restore the service.
