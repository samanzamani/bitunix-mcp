import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BitunixClient, SPOT_BASE_URL, type QueryParams } from "../http.js";
import type { Config } from "../config.js";
import {
  symbolSchema,
  decimalSchema,
  orderIdSchema,
  timestampMsSchema,
  spotIntervalSchema,
  sideSchema,
} from "../schemas.js";

function jsonResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

/** Spot API encodes side/type as integers: side 1=SELL 2=BUY, type 1=LIMIT 2=MARKET. */
const SPOT_SIDE: Record<string, number> = { SELL: 1, BUY: 2 };
const SPOT_TYPE: Record<string, number> = { LIMIT: 1, MARKET: 2 };

export function registerSpotTools(server: McpServer, client: BitunixClient, config: Config): void {
  // ---- Public market data ----

  server.registerTool(
    "spot_get_last_price",
    {
      title: "Spot: get last price",
      description: "Get the latest price for a Bitunix spot trading pair.",
      inputSchema: { symbol: symbolSchema.describe("Trading pair, e.g. BTCUSDT") },
    },
    async ({ symbol }) => {
      return jsonResult(await client.publicGet(SPOT_BASE_URL, "/api/spot/v1/market/last_price", { symbol }));
    }
  );

  server.registerTool(
    "spot_get_depth",
    {
      title: "Spot: get order book depth",
      description: "Get the order book (bids/asks) for a Bitunix spot pair.",
      inputSchema: {
        symbol: symbolSchema,
        precision: z.string().regex(/^[0-9.]{1,12}$/).optional().describe("Price aggregation precision"),
      },
    },
    async ({ symbol, precision }) => {
      const params: QueryParams = { symbol };
      if (precision) params.precision = precision;
      return jsonResult(await client.publicGet(SPOT_BASE_URL, "/api/spot/v1/market/depth", params));
    }
  );

  server.registerTool(
    "spot_get_kline",
    {
      title: "Spot: get candlesticks",
      description:
        "Get historical kline/candlestick data for a Bitunix spot pair. Intervals are in minutes (1..720) or D/W/M.",
      inputSchema: {
        symbol: symbolSchema,
        interval: spotIntervalSchema,
        endTime: timestampMsSchema.optional().describe("End time (unix ms)"),
        limit: z.number().int().min(1).max(500).optional(),
      },
    },
    async ({ symbol, interval, endTime, limit }) => {
      const params: QueryParams = { symbol, interval };
      if (endTime !== undefined) params.endTime = String(endTime);
      if (limit !== undefined) params.limit = String(limit);
      return jsonResult(await client.publicGet(SPOT_BASE_URL, "/api/spot/v1/market/kline/history", params));
    }
  );

  server.registerTool(
    "spot_get_trading_pairs",
    {
      title: "Spot: get trading pairs",
      description: "List all Bitunix spot trading pairs with precision and status info.",
      inputSchema: {},
    },
    async () => {
      return jsonResult(await client.publicGet(SPOT_BASE_URL, "/api/spot/v1/common/coin_pair/list", {}));
    }
  );

  // ---- Private, read-only ----

  server.registerTool(
    "spot_get_account",
    {
      title: "Spot: get account balances",
      description: "Get spot account balances. Requires API credentials (read permission).",
      inputSchema: {},
    },
    async () => {
      return jsonResult(await client.privateGet(SPOT_BASE_URL, "/api/spot/v1/user/account", {}));
    }
  );

  server.registerTool(
    "spot_get_pending_orders",
    {
      title: "Spot: get open orders",
      description: "Get current open (pending) spot orders. Requires API credentials.",
      inputSchema: { symbol: symbolSchema.optional() },
    },
    async ({ symbol }) => {
      const body: Record<string, unknown> = {};
      if (symbol) body.symbol = symbol;
      return jsonResult(await client.privatePost(SPOT_BASE_URL, "/api/spot/v1/order/pending/list", body));
    }
  );

  server.registerTool(
    "spot_get_order_history",
    {
      title: "Spot: get order history",
      description: "Get historical spot orders, paginated. Requires API credentials.",
      inputSchema: {
        symbol: symbolSchema.optional(),
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(100).optional(),
        startTime: timestampMsSchema.optional(),
        endTime: timestampMsSchema.optional(),
      },
    },
    async (args) => {
      const body: Record<string, unknown> = {
        page: args.page ?? 1,
        pageSize: args.pageSize ?? 20,
      };
      if (args.symbol) body.symbol = args.symbol;
      if (args.startTime !== undefined) body.startTime = args.startTime;
      if (args.endTime !== undefined) body.endTime = args.endTime;
      return jsonResult(await client.privatePost(SPOT_BASE_URL, "/api/spot/v1/order/history/page", body));
    }
  );

  server.registerTool(
    "spot_get_order_detail",
    {
      title: "Spot: get order detail",
      description: "Get details for a single spot order by orderId. Requires API credentials.",
      inputSchema: { orderId: orderIdSchema },
    },
    async ({ orderId }) => {
      return jsonResult(await client.privateGet(SPOT_BASE_URL, "/api/spot/v1/order/detail", { orderId }));
    }
  );

  // ---- Trading (only registered when BITUNIX_ENABLE_TRADING=true) ----

  if (!config.tradingEnabled) return;

  server.registerTool(
    "spot_place_order",
    {
      title: "Spot: place order",
      description:
        "Place a spot order. TRADING TOOL — only available because BITUNIX_ENABLE_TRADING=true. " +
        "Always confirm parameters with the user before calling. " +
        "For LIMIT orders volume is the base-coin quantity; for MARKET BUY orders volume is the quote-coin amount.",
      inputSchema: {
        symbol: symbolSchema,
        side: sideSchema,
        type: z.enum(["LIMIT", "MARKET"]),
        volume: decimalSchema,
        price: decimalSchema.optional().describe("Required for LIMIT orders"),
      },
    },
    async ({ symbol, side, type, volume, price }) => {
      if (type === "LIMIT" && !price) {
        throw new Error("price is required for LIMIT orders.");
      }
      const body: Record<string, unknown> = {
        symbol,
        side: SPOT_SIDE[side],
        type: SPOT_TYPE[type],
        volume,
      };
      if (price) body.price = price;
      return jsonResult(await client.privatePost(SPOT_BASE_URL, "/api/spot/v1/order/place_order", body));
    }
  );

  server.registerTool(
    "spot_cancel_orders",
    {
      title: "Spot: cancel orders",
      description:
        "Cancel one or more spot orders by orderId. TRADING TOOL — enabled via BITUNIX_ENABLE_TRADING.",
      inputSchema: {
        orderList: z
          .array(z.object({ orderId: orderIdSchema, symbol: symbolSchema }))
          .min(1)
          .max(20),
      },
    },
    async ({ orderList }) => {
      return jsonResult(
        await client.privatePost(SPOT_BASE_URL, "/api/spot/v1/order/cancel", { orderIdList: orderList })
      );
    }
  );
}
