import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BitunixClient, FUTURES_BASE_URL, type QueryParams } from "../http.js";
import type { Config } from "../config.js";
import {
  symbolSchema,
  coinSchema,
  decimalSchema,
  orderIdSchema,
  timestampMsSchema,
  futuresIntervalSchema,
  sideSchema,
  futuresOrderTypeSchema,
  effectSchema,
  tradeSideSchema,
  stopTypeSchema,
} from "../schemas.js";

function jsonResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function registerFuturesTools(server: McpServer, client: BitunixClient, config: Config): void {
  // ---- Public market data ----

  server.registerTool(
    "futures_get_tickers",
    {
      title: "Futures: get tickers",
      description:
        "Get 24h ticker data for Bitunix USDT-M futures. Optionally filter by comma-separated symbols.",
      inputSchema: {
        symbols: z.array(symbolSchema).max(50).optional().describe("Optional list of symbols, e.g. [\"BTCUSDT\"]"),
      },
    },
    async ({ symbols }) => {
      const params: QueryParams = {};
      if (symbols && symbols.length > 0) params.symbols = symbols.join(",");
      return jsonResult(await client.publicGet(FUTURES_BASE_URL, "/api/v1/futures/market/tickers", params));
    }
  );

  server.registerTool(
    "futures_get_depth",
    {
      title: "Futures: get order book depth",
      description: "Get the order book (bids/asks) for a Bitunix futures symbol.",
      inputSchema: {
        symbol: symbolSchema.describe("Trading pair, e.g. BTCUSDT"),
        limit: z.number().int().min(1).max(200).optional().describe("Depth levels (max 200)"),
      },
    },
    async ({ symbol, limit }) => {
      const params: QueryParams = { symbol };
      if (limit !== undefined) params.limit = String(limit);
      return jsonResult(await client.publicGet(FUTURES_BASE_URL, "/api/v1/futures/market/depth", params));
    }
  );

  server.registerTool(
    "futures_get_kline",
    {
      title: "Futures: get candlesticks",
      description: "Get kline/candlestick data for a Bitunix futures symbol.",
      inputSchema: {
        symbol: symbolSchema,
        interval: futuresIntervalSchema.describe("Candle interval"),
        limit: z.number().int().min(1).max(200).optional().describe("Number of candles (max 200, default 100)"),
        startTime: timestampMsSchema.optional().describe("Start time (unix ms)"),
        endTime: timestampMsSchema.optional().describe("End time (unix ms)"),
        type: z.enum(["LAST_PRICE", "MARK_PRICE"]).optional().describe("Price type (default LAST_PRICE)"),
      },
    },
    async ({ symbol, interval, limit, startTime, endTime, type }) => {
      const params: QueryParams = { symbol, interval };
      if (limit !== undefined) params.limit = String(limit);
      if (startTime !== undefined) params.startTime = String(startTime);
      if (endTime !== undefined) params.endTime = String(endTime);
      if (type !== undefined) params.type = type;
      return jsonResult(await client.publicGet(FUTURES_BASE_URL, "/api/v1/futures/market/kline", params));
    }
  );

  server.registerTool(
    "futures_get_funding_rate",
    {
      title: "Futures: get funding rate",
      description: "Get the current funding rate for a Bitunix futures symbol.",
      inputSchema: { symbol: symbolSchema },
    },
    async ({ symbol }) => {
      return jsonResult(
        await client.publicGet(FUTURES_BASE_URL, "/api/v1/futures/market/funding_rate", { symbol })
      );
    }
  );

  server.registerTool(
    "futures_get_trading_pairs",
    {
      title: "Futures: get trading pairs",
      description: "List Bitunix futures trading pairs and their contract specs.",
      inputSchema: {
        symbols: z.array(symbolSchema).max(50).optional().describe("Optional list of symbols to filter"),
      },
    },
    async ({ symbols }) => {
      const params: QueryParams = {};
      if (symbols && symbols.length > 0) params.symbols = symbols.join(",");
      return jsonResult(
        await client.publicGet(FUTURES_BASE_URL, "/api/v1/futures/market/trading_pairs", params)
      );
    }
  );

  // ---- Private, read-only ----

  server.registerTool(
    "futures_get_account",
    {
      title: "Futures: get account",
      description:
        "Get futures account balance and margin info. Requires API credentials (read permission).",
      inputSchema: {
        marginCoin: coinSchema.optional().describe("Margin coin (default USDT)"),
      },
    },
    async ({ marginCoin }) => {
      return jsonResult(
        await client.privateGet(FUTURES_BASE_URL, "/api/v1/futures/account", {
          marginCoin: marginCoin ?? "USDT",
        })
      );
    }
  );

  server.registerTool(
    "futures_get_positions",
    {
      title: "Futures: get open positions",
      description: "Get current open futures positions. Requires API credentials.",
      inputSchema: { symbol: symbolSchema.optional() },
    },
    async ({ symbol }) => {
      const params: QueryParams = {};
      if (symbol) params.symbol = symbol;
      return jsonResult(
        await client.privateGet(FUTURES_BASE_URL, "/api/v1/futures/position/get_pending_positions", params)
      );
    }
  );

  server.registerTool(
    "futures_get_history_positions",
    {
      title: "Futures: get position history",
      description: "Get closed/historical futures positions. Requires API credentials.",
      inputSchema: { symbol: symbolSchema.optional() },
    },
    async ({ symbol }) => {
      const params: QueryParams = {};
      if (symbol) params.symbol = symbol;
      return jsonResult(
        await client.privateGet(FUTURES_BASE_URL, "/api/v1/futures/position/get_history_positions", params)
      );
    }
  );

  server.registerTool(
    "futures_get_pending_orders",
    {
      title: "Futures: get open orders",
      description: "Get current open (pending) futures orders. Requires API credentials.",
      inputSchema: {
        symbol: symbolSchema.optional(),
        orderId: orderIdSchema.optional(),
        status: z.enum(["NEW", "PART_FILLED"]).optional(),
        startTime: timestampMsSchema.optional(),
        endTime: timestampMsSchema.optional(),
        skip: z.number().int().min(0).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
    },
    async (args) => {
      const params: QueryParams = {};
      if (args.symbol) params.symbol = args.symbol;
      if (args.orderId) params.orderId = args.orderId;
      if (args.status) params.status = args.status;
      if (args.startTime !== undefined) params.startTime = String(args.startTime);
      if (args.endTime !== undefined) params.endTime = String(args.endTime);
      if (args.skip !== undefined) params.skip = String(args.skip);
      if (args.limit !== undefined) params.limit = String(args.limit);
      return jsonResult(
        await client.privateGet(FUTURES_BASE_URL, "/api/v1/futures/trade/get_pending_orders", params)
      );
    }
  );

  server.registerTool(
    "futures_get_history_orders",
    {
      title: "Futures: get order history",
      description: "Get historical futures orders. Requires API credentials.",
      inputSchema: { symbol: symbolSchema.optional() },
    },
    async ({ symbol }) => {
      const params: QueryParams = {};
      if (symbol) params.symbol = symbol;
      return jsonResult(
        await client.privateGet(FUTURES_BASE_URL, "/api/v1/futures/trade/get_history_orders", params)
      );
    }
  );

  // ---- Trading (only registered when BITUNIX_ENABLE_TRADING=true) ----

  if (!config.tradingEnabled) return;

  server.registerTool(
    "futures_place_order",
    {
      title: "Futures: place order",
      description:
        "Place a futures order. TRADING TOOL — only available because BITUNIX_ENABLE_TRADING=true. " +
        "Always confirm parameters with the user before calling.",
      inputSchema: {
        symbol: symbolSchema,
        side: sideSchema,
        orderType: futuresOrderTypeSchema,
        qty: decimalSchema.describe("Order quantity in base coin, as a string"),
        price: decimalSchema.optional().describe("Required for LIMIT orders"),
        tradeSide: tradeSideSchema.optional().describe("OPEN or CLOSE (hedge mode); default OPEN"),
        positionId: orderIdSchema.optional().describe("Required when tradeSide is CLOSE"),
        effect: effectSchema.optional().describe("Time in force, default GTC"),
        reduceOnly: z.boolean().optional(),
        clientId: orderIdSchema.optional(),
        tpPrice: decimalSchema.optional(),
        tpStopType: stopTypeSchema.optional(),
        tpOrderType: futuresOrderTypeSchema.optional(),
        tpOrderPrice: decimalSchema.optional(),
        slPrice: decimalSchema.optional(),
        slStopType: stopTypeSchema.optional(),
        slOrderType: futuresOrderTypeSchema.optional(),
        slOrderPrice: decimalSchema.optional(),
      },
    },
    async (args) => {
      if (args.orderType === "LIMIT" && !args.price) {
        throw new Error("price is required for LIMIT orders.");
      }
      const body: Record<string, unknown> = {
        symbol: args.symbol,
        side: args.side,
        orderType: args.orderType,
        qty: args.qty,
      };
      for (const key of [
        "price", "tradeSide", "positionId", "effect", "reduceOnly", "clientId",
        "tpPrice", "tpStopType", "tpOrderType", "tpOrderPrice",
        "slPrice", "slStopType", "slOrderType", "slOrderPrice",
      ] as const) {
        if (args[key] !== undefined) body[key] = args[key];
      }
      return jsonResult(await client.privatePost(FUTURES_BASE_URL, "/api/v1/futures/trade/place_order", body));
    }
  );

  server.registerTool(
    "futures_cancel_orders",
    {
      title: "Futures: cancel orders",
      description:
        "Cancel one or more futures orders by orderId or clientId. TRADING TOOL — enabled via BITUNIX_ENABLE_TRADING.",
      inputSchema: {
        symbol: symbolSchema,
        orderList: z
          .array(
            z
              .object({
                orderId: orderIdSchema.optional(),
                clientId: orderIdSchema.optional(),
              })
              .refine((o) => o.orderId || o.clientId, { message: "orderId or clientId required" })
          )
          .min(1)
          .max(20),
      },
    },
    async ({ symbol, orderList }) => {
      return jsonResult(
        await client.privatePost(FUTURES_BASE_URL, "/api/v1/futures/trade/cancel_orders", {
          symbol,
          orderList,
        })
      );
    }
  );
}
