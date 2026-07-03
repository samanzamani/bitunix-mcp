# Security Policy

## Threat model

This MCP server sits between an AI model and a live exchange account, so it is designed under the assumption that **the model's tool calls may be wrong or adversarial** (e.g. prompt injection from web content the model has read).

Mitigations, in order of importance:

1. **Irreversible actions are impossible.** Withdrawal, internal transfer, and deposit-address endpoints are not implemented. A compromised or confused model cannot move funds off the exchange through this server under any configuration.
2. **Trading is opt-in.** Order placement and cancellation tools do not exist unless the operator sets `BITUNIX_ENABLE_TRADING=true` in the server environment. The model cannot enable this itself.
3. **Credentials are isolated.** Keys come only from environment variables. They are never tool parameters, never appear in tool output, and are string-scrubbed from every error message before it reaches the client.
4. **Requests cannot be redirected.** Base URLs are compile-time constants, HTTP redirects are refused (`redirect: "error"`), and all inputs pass strict zod validation (uppercase symbol patterns, decimal-string amounts, closed enums) before being placed into a query string or body.
5. **Bounded I/O.** Every request has a 15-second timeout and a 5 MB response cap.

## Residual risks you should manage

- If you enable trading, the model **can** place real orders. Use a sub-account with limited funds, and prefer MCP clients that require human approval per tool call.
- The exchange-side API key permissions are your strongest control: disable withdrawal permission and bind an IP whitelist when creating the key.
- Anyone who can edit your MCP client config or server environment can read your keys. Protect those files with filesystem permissions.

## Supported versions

Only the latest release receives security fixes.

## Reporting a vulnerability

Please open a GitHub security advisory ("Security" tab → "Report a vulnerability") rather than a public issue. Include reproduction steps. You should receive a response within 7 days.
