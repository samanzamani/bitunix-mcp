# bitunix-mcp

[![CI](https://github.com/samanzamani/bitunix-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/samanzamani/bitunix-mcp/actions/workflows/ci.yml)

A **security-first [MCP](https://modelcontextprotocol.io) server** for the [Bitunix](https://www.bitunix.com) exchange, covering both **Spot** and **USDT-M Futures** APIs.

Built for use with Claude Desktop, Claude Code, and any other MCP-compatible client.

## Security model

This server is designed so that the worst-case blast radius is as small as possible:

| Layer | Protection |
|---|---|
| **No withdrawals — ever** | Withdrawal, transfer, and deposit-address endpoints are **not implemented at all**. There is no flag to enable them. |
| **Read-only by default** | Trading tools (`place_order`, `cancel_orders`) are only registered when you explicitly set `BITUNIX_ENABLE_TRADING=true`. Without it, the AI cannot see or call them. |
| **Credentials via env only** | API keys are read from environment variables, never accepted as tool arguments, never returned in output, and redacted from all error messages. |
| **Pinned endpoints** | Base URLs (`fapi.bitunix.com`, `openapi.bitunix.com`) are hardcoded constants. Redirects are refused. No user or model input can change where requests go. |
| **Strict input validation** | Every tool argument is validated with [zod](https://github.com/colinhacks/zod) (symbol format, decimal strings, enums, bounds) before it touches a request. |
| **Hardened HTTP** | 15s request timeout, 5 MB response cap, HTTPS only. |
| **Secure signing** | Bitunix's double SHA-256 scheme with a `crypto.randomBytes` nonce per request. Secrets never leave the process. |

### Recommended API key settings on Bitunix

When creating your API key in the Bitunix dashboard:

1. **Disable withdrawal permission** — this server never needs it.
2. **Grant read-only permission** unless you intend to trade.
3. **Bind your IP address** to the key (IP whitelist).
4. Use a **dedicated sub-account** with limited funds if you enable trading.

## Installation

No install needed — run directly from npm with `npx bitunix-mcp`, or build from source:

```bash
npm install
npm run build
```

## Configuration

Configure via environment variables (see [.env.example](.env.example)):

| Variable | Required | Description |
|---|---|---|
| `BITUNIX_API_KEY` | No | API key. Omit for public market data only. |
| `BITUNIX_SECRET_KEY` | No | Secret key. Must be set together with the API key. |
| `BITUNIX_ENABLE_TRADING` | No | Set to `true` to register order placement/cancel tools. Default: off. |

### Claude Desktop / Claude Code

```json
{
  "mcpServers": {
    "bitunix": {
      "command": "npx",
      "args": ["-y", "bitunix-mcp"],
      "env": {
        "BITUNIX_API_KEY": "your-api-key",
        "BITUNIX_SECRET_KEY": "your-secret-key"
      }
    }
  }
}
```

Add `"BITUNIX_ENABLE_TRADING": "true"` only if you want the AI to be able to place and cancel orders.

With Claude Code:

```bash
claude mcp add bitunix -e BITUNIX_API_KEY=... -e BITUNIX_SECRET_KEY=... -- npx -y bitunix-mcp
```

## Tools

### Futures — public market data (no credentials needed)

| Tool | Description |
|---|---|
| `futures_get_tickers` | 24h tickers, optionally filtered by symbols |
| `futures_get_depth` | Order book bids/asks |
| `futures_get_kline` | Candlestick data (1m…1M intervals) |
| `futures_get_funding_rate` | Current funding rate |
| `futures_get_trading_pairs` | Contract specifications |

### Futures — account (requires credentials, read-only)

| Tool | Description |
|---|---|
| `futures_get_account` | Balance and margin info |
| `futures_get_positions` | Open positions |
| `futures_get_history_positions` | Closed positions |
| `futures_get_pending_orders` | Open orders |
| `futures_get_history_orders` | Order history |

### Spot — public market data

| Tool | Description |
|---|---|
| `spot_get_last_price` | Latest price for a pair |
| `spot_get_depth` | Order book bids/asks |
| `spot_get_kline` | Historical candlesticks |
| `spot_get_trading_pairs` | All spot pairs |

### Spot — account (requires credentials, read-only)

| Tool | Description |
|---|---|
| `spot_get_account` | Balances |
| `spot_get_pending_orders` | Open orders |
| `spot_get_order_history` | Order history (paginated) |
| `spot_get_order_detail` | Single order detail |

### Trading tools (only with `BITUNIX_ENABLE_TRADING=true`)

| Tool | Description |
|---|---|
| `futures_place_order` | Place a futures order (limit/market, TP/SL supported) |
| `futures_cancel_orders` | Cancel futures orders |
| `spot_place_order` | Place a spot order |
| `spot_cancel_orders` | Cancel spot orders |

## Development

```bash
npm run dev    # run from source
npm test       # run tests
npm run build  # compile to dist/
```

## Disclaimer

This is an unofficial, community-built integration. Trading cryptocurrency derivatives carries substantial risk. Nothing here is financial advice, and you are solely responsible for any orders placed through this software. See [SECURITY.md](SECURITY.md) for the threat model and reporting process.

## License

[MIT](LICENSE)
